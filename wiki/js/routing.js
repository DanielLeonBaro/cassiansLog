export function wikiPageURL(id) {
  return `wiki/#page=${encodeURIComponent(id)}`;
}

export function wikiPageId(hash = location.hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  return params.get("page");
}
