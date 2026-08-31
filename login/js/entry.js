// Coordinates email and Google sign-in while preserving safe return routes.
import { initializeTheme } from "../../shared/js/theme.js";

initializeTheme();

const params = new URLSearchParams(location.search);
const socialToken = params.get("social");
let mode = socialToken ? "social" : "login";
const form = document.getElementById("auth-form");
const email = document.getElementById("email");
const password = document.getElementById("password");
const status = document.getElementById("auth-status");
const submit = document.getElementById("submit");
const submitLabel = submit.querySelector("span");
const toggle = document.getElementById("toggle-mode");

function passwordProblem(value) {
  if (value.length < 10) return "Password must contain at least 10 characters.";
  if (!/\d/.test(value)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must contain at least one special character.";
  return "";
}

function renderMode() {
  const social = mode === "social";
  const registering = mode === "register" || social;
  document.getElementById("form-title").textContent = social ? "Finish your account" : registering ? "Create an account" : "Sign in";
  document.getElementById("form-description").textContent = social
    ? "Choose a password so you can also sign in directly with this email."
    : registering ? "Create an email account for the campaign." : "Use your account email and password.";
  document.getElementById("password-help").classList.toggle("hidden", !registering);
  document.getElementById("social-actions").classList.toggle("hidden", social);
  document.getElementById("divider").classList.toggle("hidden", social);
  document.getElementById("mode-switch").classList.toggle("hidden", social);
  email.readOnly = social;
  email.value = social ? params.get("email") || "" : email.value;
  password.autocomplete = registering ? "new-password" : "current-password";
  submitLabel.textContent = social ? "Save password & continue" : registering ? "Create account" : "Sign in";
  toggle.textContent = registering ? "Sign in instead" : "Create an account";
  status.textContent = "";
}

toggle.addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";
  renderMode();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  if (mode !== "login") {
    const problem = passwordProblem(password.value);
    if (problem) {
      status.textContent = problem;
      password.focus();
      return;
    }
  }
  submit.disabled = true;
  try {
    const path = mode === "social" ? "social/complete" : mode;
    const response = await fetch(`api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(mode === "social"
        ? { token: socialToken, password: password.value }
        : { email: email.value, password: password.value }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Authentication failed.");
    const returnTo = params.get("return");
    location.replace(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "char/");
  } catch (caught) {
    status.textContent = caught.message;
  } finally {
    submit.disabled = false;
  }
});

renderMode();
const initialError = params.get("error");
if (initialError) status.textContent = initialError;
