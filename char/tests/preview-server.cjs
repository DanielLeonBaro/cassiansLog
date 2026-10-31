// Local, read-only preview server. No APIs or character document routes are served.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const allowed = ["char/js/", "char/tests/previews/", "shared/js/", "shared/gc/", "shared/assets/"];
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff": "font/woff", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
function createPreviewServer() {
  return http.createServer((request, response) => {
    let relative;
    try { relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, ""); }
    catch { response.writeHead(400); response.end(); return; }
    if (!relative) { response.writeHead(302, { location: "/char/tests/previews/" }); response.end(); return; }
    if (relative.endsWith("/")) relative += "index.html";
    const file = path.resolve(root, relative);
    const normalized = path.relative(root, file).split(path.sep).join("/");
    if (!["GET", "HEAD"].includes(request.method) || !allowed.some((prefix) => normalized.startsWith(prefix)) || !file.startsWith(root + path.sep) || !types[path.extname(file)] || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": types[path.extname(file)], "cache-control": "no-store" });
    if (request.method === "HEAD") response.end(); else fs.createReadStream(file).pipe(response);
  });
}
if (require.main === module) createPreviewServer().listen(Number(process.env.PORT) || 4173, "127.0.0.1", () => console.log(`Tracker previews: http://127.0.0.1:${Number(process.env.PORT) || 4173}/char/tests/previews/`));
module.exports = { createPreviewServer };
