// Wraps authenticated JSON reads and writes with campaign and write-token compatibility.
import { campaignApiPath, currentCampaignSlug } from "./campaign-context.js";
const TOKEN_KEY = "cassianslog-write-token";

export class CloudStoreError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause });
    this.name = "CloudStoreError";
    this.status = status;
  }
}

async function responseError(response) {
  try {
    const body = await response.json();
    return body.error || `Cloud request failed (${response.status}).`;
  } catch {
    return `Cloud request failed (${response.status}).`;
  }
}

export async function readCloudJSON(path, { fallback = null } = {}) {
  try {
    const response = await fetch(campaignApiPath(path), { headers: { accept: "application/json" } });
    if (response.status === 404 || response.status === 503) return fallback;
    if (!response.ok) throw new CloudStoreError(await responseError(response), { status: response.status });
    return response.json();
  } catch (error) {
    if (error instanceof CloudStoreError) throw error;
    return fallback;
  }
}

function editToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function requestEditToken() {
  const token = window.prompt("Enter the Cassian's Log edit password:")?.trim() || "";
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function clearCloudEditToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function writeCloudJSON(path, value, { method = "PUT" } = {}) {
  const requestPath = campaignApiPath(path);
  if (currentCampaignSlug()) {
    const response = await fetch(requestPath, {
      method,
      headers: { accept: "application/json", "content-type": "application/json" },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    if (!response.ok) throw new CloudStoreError(await responseError(response), { status: response.status });
    return response.json();
  }
  let token = editToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(requestPath, {
      method,
      headers,
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    if (response.status === 401 && attempt === 0) {
      clearCloudEditToken();
      token = requestEditToken();
      if (!token) throw new CloudStoreError("Cloud save cancelled.", { status: 401 });
      continue;
    }
    if (!response.ok) throw new CloudStoreError(await responseError(response), { status: response.status });
    return response.json();
  }
  throw new CloudStoreError("The edit password was rejected.", { status: 401 });
}
