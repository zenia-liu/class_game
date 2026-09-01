import { aiAvailable, demoPack, generatePack, safeText } from "../lib/generator.mjs";

const attempts = new Map();

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function allowGenerate(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown");
  const key = forwarded.split(",")[0].trim();
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(time => now - time < 10 * 60_000);
  if (recent.length >= 20) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export default async function handler(req, res) {
  const path = String(req.query?.path || "").replace(/^\/+|\/+$/g, "");
  try {
    if (req.method === "GET" && path === "health") return sendJson(res, 200, { ok: true });
    if (req.method === "GET" && path === "config") {
      const body = { aiAvailable: aiAvailable(), modelLabel: aiAvailable() ? "智能出题已连接" : "演示题库模式" };
      if (req.query?.debug === "1") {
        body.diag = {
          workshopVars: Object.keys(process.env).filter(key => key.toUpperCase().includes("WORKSHOP")).sort(),
          keyLength: (process.env.WORKSHOP_AI_API_KEY || "").length,
          model: process.env.WORKSHOP_AI_MODEL || "(未设置，默认 deepseek-chat)",
          baseUrl: process.env.WORKSHOP_AI_BASE_URL || "(未设置，默认 https://api.deepseek.com)",
          chatUrl: process.env.WORKSHOP_AI_CHAT_URL || "(未设置)",
          jsonMode: process.env.WORKSHOP_AI_JSON_MODE || "(未设置，默认开启)"
        };
      }
      return sendJson(res, 200, body);
    }
    if (req.method === "POST" && path === "generate") {
      if (!allowGenerate(req)) return sendJson(res, 429, { error: "生成得有些频繁，请十分钟后再试" });
      const body = await readBody(req);
      const prompt = safeText(body.prompt, 12000);
      if (prompt.length < 2) return sendJson(res, 400, { error: "请先告诉我今天想让学生练什么" });
      try { return sendJson(res, 200, await generatePack(prompt, body)); }
      catch (error) { return sendJson(res, 502, { error: `智能出题暂时没有完成：${error.message}`, fallback: demoPack(prompt) }); }
    }
    return sendJson(res, 404, { error: "接口不存在" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "服务器暂时开小差了" });
  }
}

export const config = { maxDuration: 60 };
