// Tiny local preview server for the birthday page.
// Run: bun serve.ts  →  http://127.0.0.1:4173
const root = import.meta.dir;
const port = 4173;

await Bun.write(`${root}/.freebuff/preview.pid`, String(process.pid));

Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    if (pathname.includes("..")) return new Response("Forbidden", { status: 403 });
    const file = Bun.file(root + pathname);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "cache-control": "no-store" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`serving http://127.0.0.1:${port} (pid ${process.pid})`);
