import { bodyJSON, error, json } from "../http.js";
import {
  DEFAULT_ROLES,
  PRIMARY_ADMIN_EMAIL,
  consumeOpaqueState,
  createOpaqueState,
  createSession,
  destroySession,
  ensurePrimaryAdmin,
  hashPassword,
  isLocalRequest,
  normalizeEmail,
  passwordProblem,
  publicUser,
  userFromRequest,
  validEmail,
  verifyPassword,
} from "../user-auth.js";

function jsonWithCookie(value, cookie, status = 200) {
  return json(value, status, { "set-cookie": cookie });
}

async function credentialsRow(email, env) {
  return env.DB.prepare(
    "SELECT id, email, password_hash, password_salt, password_iterations, roles_json FROM users WHERE email = ? COLLATE NOCASE",
  ).bind(email).first();
}

async function credentialsRowById(id, env) {
  return env.DB.prepare(
    "SELECT id, email, password_hash, password_salt, password_iterations, roles_json FROM users WHERE id = ?",
  ).bind(id).first();
}

async function userWithProviders(request, env) {
  const user = await userFromRequest(request, env);
  if (!user || user.localBypass) return user;
  const providers = await env.DB.prepare(
    "SELECT provider FROM oauth_accounts WHERE user_id = ? ORDER BY provider",
  ).bind(user.id).all();
  return { ...user, providers: providers.results.map((row) => row.provider) };
}

function accountRedirect(origin, message, failed = false) {
  const target = new URL("/char/", origin);
  target.searchParams.set(failed ? "account_error" : "account", message);
  return Response.redirect(target.toString(), 302);
}

function oauthConfig(provider, env, origin) {
  const callback = `${origin}/api/auth/oauth/${provider}/callback`;
  if (provider === "google" && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      secret: env.GOOGLE_CLIENT_SECRET,
      callback,
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      profile: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
    };
  }
  if (provider === "facebook" && env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
    return {
      clientId: env.FACEBOOK_APP_ID,
      secret: env.FACEBOOK_APP_SECRET,
      callback,
      authorization: "https://www.facebook.com/v23.0/dialog/oauth",
      token: "https://graph.facebook.com/v23.0/oauth/access_token",
      profile: "https://graph.facebook.com/me?fields=id,email",
      scope: "email",
    };
  }
  return null;
}

async function oauthProfile(provider, code, config) {
  const tokenResponse = await fetch(config.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.callback,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("The provider rejected the authorization code.");
  const token = await tokenResponse.json();
  const separator = config.profile.includes("?") ? "&" : "?";
  const profileResponse = await fetch(`${config.profile}${separator}access_token=${encodeURIComponent(token.access_token)}`, {
    headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" },
  });
  if (!profileResponse.ok) throw new Error("The provider profile could not be loaded.");
  const profile = await profileResponse.json();
  const email = normalizeEmail(profile.email);
  if (!profile.id && !profile.sub) throw new Error("The provider did not return an account ID.");
  if (!validEmail(email)) throw new Error("The provider account must share a valid email address.");
  return { providerUserId: String(profile.id || profile.sub), email };
}

async function beginOAuth(request, provider, env) {
  const requestURL = new URL(request.url);
  const origin = requestURL.origin;
  const linking = requestURL.searchParams.get("mode") === "link";
  const user = linking ? await userFromRequest(request, env) : null;
  if (linking && !user) return Response.redirect(`${origin}/login/`, 302);
  if (linking && user.localBypass) return accountRedirect(origin, "Account connections are disabled during localhost login bypass.", true);
  const config = oauthConfig(provider, env, origin);
  if (!config) {
    const message = `${provider} login is not configured.`;
    return linking
      ? accountRedirect(origin, message, true)
      : Response.redirect(`${origin}/login/?error=${encodeURIComponent(message)}`, 302);
  }
  const state = await createOpaqueState(provider, linking
    ? { purpose: "link-account", userId: user.id }
    : { purpose: "oauth-callback" }, env);
  const target = new URL(config.authorization);
  target.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callback,
    response_type: "code",
    scope: config.scope,
    state,
  }).toString();
  return Response.redirect(target.toString(), 302);
}

async function finishOAuth(request, provider, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = await consumeOpaqueState(url.searchParams.get("state"), provider, env);
  if (!state || !["oauth-callback", "link-account"].includes(state.purpose)) {
    return Response.redirect(`${origin}/login/?error=${encodeURIComponent("The social login request expired or was invalid.")}`, 302);
  }
  if (url.searchParams.get("error") || !url.searchParams.get("code")) {
    return state.purpose === "link-account"
      ? accountRedirect(origin, "Account connection was cancelled.", true)
      : Response.redirect(`${origin}/login/?error=${encodeURIComponent("Social login was cancelled.")}`, 302);
  }
  try {
    const config = oauthConfig(provider, env, origin);
    if (!config) throw new Error(`${provider} login is not configured.`);
    const identity = await oauthProfile(provider, url.searchParams.get("code"), config);
    if (state.purpose === "link-account") {
      const existing = await env.DB.prepare(
        "SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?",
      ).bind(provider, identity.providerUserId).first();
      if (existing && existing.user_id !== state.userId) {
        throw new Error(`That ${provider} account is already linked to another user.`);
      }
      const target = await credentialsRowById(state.userId, env);
      if (!target) throw new Error("The account being linked no longer exists.");
      await env.DB.prepare(
        "INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(provider, user_id) DO UPDATE SET provider_user_id = excluded.provider_user_id",
      ).bind(provider, identity.providerUserId, state.userId, new Date().toISOString()).run();
      return accountRedirect(origin, `${provider} linked`);
    }
    let user = await env.DB.prepare(
      "SELECT users.id, users.email, users.roles_json FROM oauth_accounts JOIN users ON users.id = oauth_accounts.user_id WHERE oauth_accounts.provider = ? AND oauth_accounts.provider_user_id = ?",
    ).bind(provider, identity.providerUserId).first();
    if (!user) user = await credentialsRow(identity.email, env);
    if (user) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)",
      ).bind(provider, identity.providerUserId, user.id, new Date().toISOString()).run();
      const cookie = await createSession(user.id, env);
      return new Response(null, { status: 302, headers: { location: `${origin}/char/`, "set-cookie": cookie } });
    }
    const signupToken = await createOpaqueState("social-signup", { ...identity, provider }, env, 15);
    return Response.redirect(`${origin}/login/?social=${encodeURIComponent(signupToken)}&email=${encodeURIComponent(identity.email)}`, 302);
  } catch (caught) {
    const message = caught.message || "Social login failed.";
    return state.purpose === "link-account"
      ? accountRedirect(origin, message, true)
      : Response.redirect(`${origin}/login/?error=${encodeURIComponent(message)}`, 302);
  }
}

export async function authRoute(request, env, parts) {
  const action = parts[0] || "session";
  if (isLocalRequest(request)) {
    if (request.method === "GET" && action === "session") return json({ user: await userFromRequest(request, env) });
    if (request.method === "POST" && action === "logout") return json({ ok: true });
    return error("Account changes are disabled while localhost login bypass is active.", 409);
  }
  await ensurePrimaryAdmin(env);
  if (request.method === "GET" && action === "session") {
    return json({ user: await userWithProviders(request, env) });
  }
  if (request.method === "POST" && action === "register") {
    const body = await bodyJSON(request);
    const email = normalizeEmail(body?.email);
    if (!validEmail(email)) return error("Enter a valid email address.");
    const problem = passwordProblem(body?.password);
    if (problem) return error(problem);
    const credentials = await hashPassword(body.password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(id, email, credentials.hash, credentials.salt, credentials.iterations, JSON.stringify(DEFAULT_ROLES), now, now).run();
    } catch {
      return error("An account with that email already exists.", 409);
    }
    return jsonWithCookie({ user: publicUser({ id, email, roles_json: JSON.stringify(DEFAULT_ROLES) }) }, await createSession(id, env), 201);
  }
  if (request.method === "POST" && action === "login") {
    const body = await bodyJSON(request);
    const email = normalizeEmail(body?.email);
    const row = await credentialsRow(email, env);
    if (!await verifyPassword(row, body?.password)) return error("Email or password is incorrect.", 401);
    return jsonWithCookie({ user: publicUser(row) }, await createSession(row.id, env));
  }
  if (request.method === "POST" && action === "logout") {
    return jsonWithCookie({ ok: true }, await destroySession(request, env));
  }
  if (request.method === "POST" && action === "password") {
    const user = await userFromRequest(request, env);
    if (!user) return error("Sign in required.", 401);
    const body = await bodyJSON(request);
    const problem = passwordProblem(body?.newPassword);
    if (problem) return error(problem);
    const row = await credentialsRowById(user.id, env);
    if (!await verifyPassword(row, body?.currentPassword)) return error("Current password is incorrect.", 401);
    const credentials = await hashPassword(body.newPassword);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?",
    ).bind(credentials.hash, credentials.salt, credentials.iterations, new Date().toISOString(), user.id).run();
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(user.id).run();
    return jsonWithCookie({ ok: true }, await createSession(user.id, env));
  }
  if (request.method === "PUT" && action === "email") {
    const user = await userFromRequest(request, env);
    if (!user) return error("Sign in required.", 401);
    if (user.isPrimaryAdmin) return error(`The primary administrator email must remain ${PRIMARY_ADMIN_EMAIL}.`, 409);
    const body = await bodyJSON(request);
    const email = normalizeEmail(body?.email);
    if (!validEmail(email)) return error("Enter a valid email address.");
    const row = await credentialsRowById(user.id, env);
    if (!await verifyPassword(row, body?.password)) return error("Password is incorrect.", 401);
    try {
      await env.DB.prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?")
        .bind(email, new Date().toISOString(), user.id).run();
    } catch {
      return error("An account with that email already exists.", 409);
    }
    return json({ user: { ...user, email } });
  }
  if (request.method === "DELETE" && action === "providers" && ["google", "facebook"].includes(parts[1])) {
    const user = await userFromRequest(request, env);
    if (!user) return error("Sign in required.", 401);
    await env.DB.prepare("DELETE FROM oauth_accounts WHERE provider = ? AND user_id = ?")
      .bind(parts[1], user.id).run();
    return json({ ok: true, provider: parts[1] });
  }
  if (request.method === "POST" && action === "social" && parts[1] === "complete") {
    const body = await bodyJSON(request);
    const context = await consumeOpaqueState(body?.token, "social-signup", env);
    if (!context?.email || !context?.provider || !context?.providerUserId) return error("The social signup expired. Start again.", 401);
    const problem = passwordProblem(body?.password);
    if (problem) return error(problem);
    const credentials = await hashPassword(body.password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(id, context.email, credentials.hash, credentials.salt, credentials.iterations, JSON.stringify(DEFAULT_ROLES), now, now).run();
      await env.DB.prepare(
        "INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)",
      ).bind(context.provider, context.providerUserId, id, now).run();
    } catch {
      return error("That email is already registered. Sign in with its password, then connect the provider again.", 409);
    }
    return jsonWithCookie({ user: publicUser({ id, email: context.email, roles_json: JSON.stringify(DEFAULT_ROLES) }) }, await createSession(id, env), 201);
  }
  if (request.method === "GET" && action === "oauth" && ["google", "facebook"].includes(parts[1])) {
    return parts[2] === "callback"
      ? finishOAuth(request, parts[1], env)
      : beginOAuth(request, parts[1], env);
  }
  return error("Authentication route not found.", 404);
}
