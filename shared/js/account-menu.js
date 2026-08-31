// Builds the account dialog for email, password, OAuth, and session actions.
import { escapeHTML } from "./text.js";

const fieldClass = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-white/5 dark:text-white";
const secondaryButton = "rounded-xl border border-stone-400 px-4 py-2 text-sm font-bold hover:border-blood-500 hover:text-blood-500 dark:border-white/20";

async function accountRequest(path, options = {}) {
  const response = await fetch(`api/auth/${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Account request failed (${response.status}).`);
  return body;
}

function providerControls(user) {
  return [
    { id: "google", label: "Google", icon: "bi-google" },
  ].map((provider) => {
    const linked = user.providers?.includes(provider.id);
    return `<div class="flex items-center justify-between gap-3 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <span class="flex items-center gap-3"><i class="bi ${provider.icon} text-lg"></i><span><strong class="block">${provider.label}</strong><small class="text-stone-500 dark:text-stone-400">${linked ? "Connected" : "Not connected"}</small></span></span>
      ${linked
        ? `<button type="button" data-unlink-provider="${provider.id}" class="${secondaryButton}">Unlink</button>`
        : `<a href="api/auth/oauth/${provider.id}?mode=link" class="${secondaryButton}">Connect</a>`}
    </div>`;
  }).join("");
}

function setStatus(root, message, kind = "neutral") {
  const status = root.querySelector("[data-account-status]");
  status.textContent = message;
  status.className = `min-h-5 text-sm ${kind === "error" ? "text-danger-500" : kind === "success" ? "text-emerald-600 dark:text-emerald-300" : "text-stone-500 dark:text-stone-400"}`;
}

export function mountAccountMenu(button, user) {
  if (!button || !user || document.querySelector("[data-account-dialog]")) return;
  const root = document.createElement("div");
  root.dataset.accountDialog = "";
  root.className = "fixed inset-0 z-[70] hidden items-center justify-center bg-ink/80 p-3 backdrop-blur-sm sm:p-6";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "account-dialog-title");
  root.innerHTML = `<div class="max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-300 bg-parchment p-5 shadow-2xl dark:border-white/15 dark:bg-ink sm:p-7">
    <div class="flex items-start justify-between gap-4">
      <div><p class="text-xs font-bold uppercase tracking-[.18em] text-blood-500">Account settings</p><h2 id="account-dialog-title" class="mt-1 font-display text-3xl font-bold">Me</h2><p data-account-email class="mt-1 text-sm text-stone-500 dark:text-stone-400">${escapeHTML(user.email)}</p></div>
      <button type="button" data-close-account class="rounded-xl p-2 hover:bg-stone-200 dark:hover:bg-white/10" aria-label="Close account settings"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="mt-5"><p data-account-status class="min-h-5 text-sm text-stone-500 dark:text-stone-400"></p></div>
    ${user.localBypass ? `<div class="mt-4 rounded-2xl border border-gold/50 bg-gold/10 p-4 text-sm"><strong class="block">Localhost login bypass is active.</strong><span class="mt-1 block text-stone-500 dark:text-stone-400">Account, password, email, and provider changes are disabled locally. Use the deployed site to manage the real account.</span></div>` : `
      <section class="mt-5 rounded-2xl border border-stone-300 p-4 dark:border-white/15">
        <h3 class="font-display text-xl font-bold">Email</h3>
        ${user.isPrimaryAdmin ? `<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">The primary administrator email is fixed to ${escapeHTML(user.email)}.</p>` : `<form data-email-form class="mt-4 grid gap-3 sm:grid-cols-2">
          <label><span class="mb-1 block text-sm font-bold">New email</span><input name="email" type="email" required autocomplete="email" class="${fieldClass}"></label>
          <label><span class="mb-1 block text-sm font-bold">Current password</span><input name="password" type="password" required autocomplete="current-password" class="${fieldClass}"></label>
          <button type="submit" class="rounded-xl bg-blood-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-blood-600 sm:col-span-2 sm:justify-self-end">Change email</button>
        </form>`}
      </section>
      <section class="mt-4 rounded-2xl border border-stone-300 p-4 dark:border-white/15">
        <h3 class="font-display text-xl font-bold">Password</h3>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">At least 10 characters, one number, and one special character.</p>
        <form data-password-form class="mt-4 grid gap-3 sm:grid-cols-2">
          <label><span class="mb-1 block text-sm font-bold">Current password</span><input name="currentPassword" type="password" required autocomplete="current-password" class="${fieldClass}"></label>
          <label><span class="mb-1 block text-sm font-bold">New password</span><input name="newPassword" type="password" required minlength="10" autocomplete="new-password" class="${fieldClass}"></label>
          <button type="submit" class="rounded-xl bg-blood-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-blood-600 sm:col-span-2 sm:justify-self-end">Reset password</button>
        </form>
      </section>
      <section class="mt-4 rounded-2xl border border-stone-300 p-4 dark:border-white/15">
        <h3 class="font-display text-xl font-bold">Connected accounts</h3>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Manage the Google account you can use to sign in.</p>
        <div data-provider-controls class="mt-4 space-y-2">${providerControls(user)}</div>
      </section>`}
  </div>`;
  document.body.append(root);

  const open = () => {
    root.classList.remove("hidden");
    root.classList.add("flex");
    root.querySelector("[data-close-account]").focus();
  };
  const close = () => {
    root.classList.add("hidden");
    root.classList.remove("flex");
    button.focus();
  };
  button.addEventListener("click", open);
  root.querySelector("[data-close-account]").addEventListener("click", close);
  root.addEventListener("click", (event) => { if (event.target === root) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !root.classList.contains("hidden")) close(); });

  root.querySelector("[data-email-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await accountRequest("email", {
        method: "PUT",
        body: JSON.stringify({ email: form.email.value, password: form.password.value }),
      });
      user.email = result.user.email;
      root.querySelector("[data-account-email]").textContent = user.email;
      document.dispatchEvent(new CustomEvent("cassianslog:account-updated", { detail: user }));
      form.reset();
      setStatus(root, "Email changed.", "success");
    } catch (caught) {
      setStatus(root, caught.message, "error");
    } finally {
      submit.disabled = false;
    }
  });

  root.querySelector("[data-password-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await accountRequest("password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.currentPassword.value, newPassword: form.newPassword.value }),
      });
      form.reset();
      setStatus(root, "Password reset. Your other sessions were signed out.", "success");
    } catch (caught) {
      setStatus(root, caught.message, "error");
    } finally {
      submit.disabled = false;
    }
  });

  root.querySelector("[data-provider-controls]")?.addEventListener("click", async (event) => {
    const unlink = event.target.closest("[data-unlink-provider]");
    if (!unlink) return;
    unlink.disabled = true;
    try {
      await accountRequest(`providers/${unlink.dataset.unlinkProvider}`, { method: "DELETE" });
      user.providers = user.providers.filter((provider) => provider !== unlink.dataset.unlinkProvider);
      root.querySelector("[data-provider-controls]").innerHTML = providerControls(user);
      setStatus(root, `${unlink.dataset.unlinkProvider} unlinked.`, "success");
    } catch (caught) {
      setStatus(root, caught.message, "error");
      unlink.disabled = false;
    }
  });

  const params = new URLSearchParams(location.search);
  const accountMessage = params.get("account") || params.get("account_error");
  if (accountMessage) {
    open();
    setStatus(root, accountMessage, params.has("account_error") ? "error" : "success");
    params.delete("account");
    params.delete("account_error");
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }
}
