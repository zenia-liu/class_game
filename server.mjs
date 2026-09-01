import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { aiAvailable, demoPack, generatePack, safeText } from "./lib/generator.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
try { process.loadEnvFile(join(ROOT, ".env")); console.log("已读取本地 .env 配置"); } catch { /* 没有 .env 时使用系统环境变量 */ }
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || process.env.WORKSHOP_PORT || 4173);
const HOST = process.env.WORKSHOP_HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("请求格式不正确"); }
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true });
  if (req.method === "GET" && url.pathname === "/api/config") return sendJson(res, 200, { aiAvailable: aiAvailable(), modelLabel: aiAvailable() ? "智能出题已连接" : "演示题库模式" });
  if (req.method === "POST" && url.pathname === "/api/generate") {
    const body = await readJson(req);
    const prompt = safeText(body.prompt, 12000);
    if (prompt.length < 2) return sendJson(res, 400, { error: "请先告诉我今天想让学生练什么" });
    try { return sendJson(res, 200, await generatePack(prompt, body)); }
    catch (error) { return sendJson(res, 502, { error: `智能出题暂时没有完成：${error.message}`, fallback: demoPack(prompt) }); }
  }
  return sendJson(res, 404, { error: "接口不存在" });
}

function serveStatic(res, url) {
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = resolve(PUBLIC_DIR, normalize(requested));
  const publicRoot = resolve(PUBLIC_DIR);
  if ((filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("页面不存在");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else serveStatic(res, url);
  } catch (error) { sendJson(res, 500, { error: error.message || "服务器暂时开小差了" }); }
});

server.listen(PORT, HOST, () => {
  console.log(`课游工坊已启动：http://${HOST}:${PORT}`);
  console.log(aiAvailable() ? `AI 模型：${process.env.WORKSHOP_AI_MODEL || "deepseek-chat"}` : "AI：演示题库模式（可设置 WORKSHOP_AI_API_KEY）");
});
