import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import handler from "../api/index.mjs";

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
assert.ok(vercel.rewrites.some(rule => rule.source === "/api/:path*"));
assert.ok(vercel.rewrites.some(rule => rule.source === "/"));

const healthResponse = responseRecorder();
await handler({ method: "GET", query: { path: "health" }, headers: {}, socket: {} }, healthResponse);
assert.equal(healthResponse.statusCode, 200);
assert.deepEqual(healthResponse.body, { ok: true });

const generateResponse = responseRecorder();
await handler({
  method: "POST", query: { path: "generate" }, headers: { "x-forwarded-for": "127.0.0.1" }, socket: {},
  body: { prompt: "给三年级学生复习两位数乘一位数", grade: "三年级", subject: "数学", count: 8 }
}, generateResponse);
assert.equal(generateResponse.statusCode, 200);
assert.equal(generateResponse.body.mode, "demo");
assert.ok(generateResponse.body.pack.quizItems.length >= 8);

console.log("Vercel 检查通过：路由配置、健康接口和无 Key 演示生成均正常。");
