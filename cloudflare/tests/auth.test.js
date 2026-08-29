import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_ROLES,
  ASSIGNABLE_ROLES,
  PRIMARY_ADMIN_EMAIL,
  hashPassword,
  isLocalRequest,
  localBypassUser,
  passwordProblem,
  publicUser,
  verifyPassword,
} from "../user-auth.js";

assert.equal(passwordProblem("short1!"), "Password must contain at least 10 characters.");
assert.equal(passwordProblem("longpassword!"), "Password must contain at least one number.");
assert.equal(passwordProblem("longpassword1"), "Password must contain at least one special character.");
assert.equal(passwordProblem("longPassword1!"), "");
assert.equal(isLocalRequest(new Request("http://localhost:8787/char/")), true);
assert.equal(isLocalRequest(new Request("http://127.0.0.1:8787/char/")), true);
assert.equal(isLocalRequest(new Request("https://example.test/char/")), false);
assert.equal(localBypassUser().localBypass, true);
assert.ok(localBypassUser().roles.includes("admin"));

const credentials = await hashPassword("longPassword1!");
assert.equal(credentials.iterations, 100_000, "PBKDF2 must stay within the Cloudflare Workers limit.");
const row = {
  password_hash: credentials.hash,
  password_salt: credentials.salt,
  password_iterations: credentials.iterations,
};
assert.equal(await verifyPassword(row, "longPassword1!"), true);
assert.equal(await verifyPassword(row, "wrongPassword1!"), false);

const ordinary = publicUser({ id: "user-1", email: "player@example.com", roles_json: '["wiki"]' });
assert.deepEqual(ordinary.roles, ["characters", "player-screen", "wiki"], "Character and Player Screen access are mandatory for signed-in accounts.");
const primary = publicUser({ id: "admin-1", email: PRIMARY_ADMIN_EMAIL, roles_json: "[]" });
assert.equal(primary.isPrimaryAdmin, true);
assert.deepEqual(primary.roles, [...ASSIGNABLE_ROLES, "admin"]);

const migration = fs.readFileSync("cloudflare/migrations/0006_user_authentication.sql", "utf8");
for (const table of ["users", "oauth_accounts", "user_sessions", "oauth_states"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
const adminRoute = fs.readFileSync("cloudflare/routes/admin.js", "utf8");
assert.match(adminRoute, /parts\[2\] === "roles"/, "Admin must expose per-user role management.");
assert.match(adminRoute, /parts\[2\] === "password"/, "Admin must expose password resets.");
assert.match(adminRoute, /DELETE FROM user_sessions WHERE user_id/, "Password resets must revoke the user's sessions.");
const authRoute = fs.readFileSync("cloudflare/routes/auth.js", "utf8");
assert.match(authRoute, /action === "password"/, "Users must be able to reset their own password.");
assert.match(authRoute, /action === "email"/, "Users must be able to change their own email.");
assert.match(authRoute, /action === "providers"/, "Users must be able to unlink social accounts.");
assert.match(authRoute, /purpose: "link-account"/, "OAuth must support linking providers to an authenticated user.");
assert.doesNotMatch(authRoute, /facebook/i, "Facebook OAuth must remain disabled.");

console.log("User authentication and password policy tests passed.");
