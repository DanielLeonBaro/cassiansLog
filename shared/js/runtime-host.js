const LOCAL_RUNTIME_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalRuntimeHost(hostname = globalThis.location?.hostname || "") {
  return LOCAL_RUNTIME_HOSTS.has(String(hostname).toLowerCase());
}
