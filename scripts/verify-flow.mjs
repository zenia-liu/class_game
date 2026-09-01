import http from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const post = (port, body) => fetch(`http://127.0.0.1:${port}/api/generate`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
}).then(async r => ({ status: r.status, json: await r.json() }));

function startServer(env, port) {
  return new Promise((resolveStart, reject) => {
    const child = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, ...env, WORKSHOP_PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", d => { if (String(d).includes("已启动")) resolveStart(child); });
    child.stderr.on("data", d => console.error("[server]", String(d)));
    setTimeout(() => reject(new Error("server start timeout")), 8000);
  });
}

// ========== 场景1：无 Key（演示模式）——连续生成两次，题目应完全相同 ==========
{
  const env = { WORKSHOP_AI_API_KEY: "" };
  const server = await startServer(env, 4711);
  const a = await post(4711, { prompt: "三年级数学 两位数乘一位数", grade: "三年级", subject: "数学", count: 10 });
  const b = await post(4711, { prompt: "三年级数学 两位数乘一位数", grade: "三年级", subject: "数学", count: 10 });
  assert.equal(a.status, 200);
  assert.equal(a.json.mode, "demo");
  const promptsA = a.json.pack.quizItems.map(q => q.prompt).join("|");
  const promptsB = b.json.pack.quizItems.map(q => q.prompt).join("|");
  assert.equal(promptsA, promptsB);
  console.log("场景1【演示模式】：mode =", a.json.mode, "| notice =", a.json.notice);
  console.log("  两次生成的题目完全相同：", promptsA === promptsB, "（前3题：", a.json.pack.quizItems.slice(0,3).map(q=>q.prompt).join("、"), "）");
  server.kill();
}

// ========== 场景2：接入模拟 AI 服务——完整 HTTP 链路，题目应为 AI 生成且每次不同 ==========
{
  let callCount = 0;
  const mockAi = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const parsed = JSON.parse(body);
    assert.ok(parsed.max_tokens >= 4097, "请求必须带足够大的 max_tokens");
    callCount++;
    const pack = {
      meta: { title: `AI生成第${callCount}批`, subject: "数学", grade: "三年级", knowledgePoint: "两位数乘一位数" },
      quizItems: Array.from({ length: 10 }, (_, i) => ({ type: "choice", prompt: `【第${callCount}批】${20 + callCount} × ${i + 2} = ?`, options: [String((20 + callCount) * (i + 2)), "10", "20", "30"], answer: String((20 + callCount) * (i + 2)), explanation: "乘法计算。" })),
      pairs: Array.from({ length: 8 }, (_, i) => ({ left: `${callCount}L${i}`, right: `${callCount}R${i}` })),
      cards: Array.from({ length: 16 }, (_, i) => ({ text: `${callCount}卡${i}`, answer: `${callCount}答${i}` }))
    };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(pack) } }] }));
  });
  await new Promise(r => mockAi.listen(4712, "127.0.0.1", r));
  const env = { WORKSHOP_AI_API_KEY: "mock-key", WORKSHOP_AI_CHAT_URL: "http://127.0.0.1:4712/v1/chat/completions" };
  const server = await startServer(env, 4713);
  const a = await post(4713, { prompt: "三年级数学 两位数乘一位数", grade: "三年级", subject: "数学", count: 10 });
  const b = await post(4713, { prompt: "三年级数学 两位数乘一位数", grade: "三年级", subject: "数学", count: 10 });
  assert.equal(a.json.mode, "ai");
  assert.ok(a.json.pack.quizItems.every(q => q.options.length === 4 && q.answer && q.explanation));
  assert.notEqual(a.json.pack.quizItems[0].prompt, b.json.pack.quizItems[0].prompt);
  console.log("场景2【AI 模式】：mode =", a.json.mode, "| 每题都有4个选项+答案+解析：true");
  console.log("  两次生成的题目不同：", a.json.pack.quizItems[0].prompt, "vs", b.json.pack.quizItems[0].prompt);
  server.kill();

  // ========== 场景3：Vercel handler 同链路 ==========
  process.env.WORKSHOP_AI_API_KEY = "mock-key";
  process.env.WORKSHOP_AI_CHAT_URL = "http://127.0.0.1:4712/v1/chat/completions";
  const { default: handler } = await import("../api/index.mjs");
  const res = { statusCode: 0, setHeader() {}, end(v) { this.body = JSON.parse(v); } };
  await handler({ method: "POST", query: { path: "generate" }, headers: { "x-forwarded-for": "9.9.9.9" }, socket: {}, body: { prompt: "三年级数学 两位数乘一位数", grade: "三年级", subject: "数学", count: 10 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "ai");
  console.log("场景3【Vercel handler】：mode =", res.body.mode, "| 题目示例：", res.body.pack.quizItems[0].prompt, "答案：", res.body.pack.quizItems[0].answer);

  // ========== 场景4：AI 服务报错（如余额不足 402）——应返回具体错误+降级包 ==========
  process.env.WORKSHOP_AI_CHAT_URL = "http://127.0.0.1:4714/v1/chat/completions";
  const badAi = http.createServer((req, res) => { res.statusCode = 402; res.end(JSON.stringify({ error: { message: "Insufficient Balance" } })); });
  await new Promise(r => badAi.listen(4714, "127.0.0.1", r));
  const res2 = { statusCode: 0, setHeader() {}, end(v) { this.body = JSON.parse(v); } };
  await handler({ method: "POST", query: { path: "generate" }, headers: { "x-forwarded-for": "8.8.8.8" }, socket: {}, body: { prompt: "三年级数学", grade: "三年级", subject: "数学" } }, res2);
  assert.equal(res2.statusCode, 502);
  assert.ok(res2.body.error.includes("402"));
  assert.ok(res2.body.fallback);
  console.log("场景4【AI 报错降级】：状态 =", res2.statusCode, "| 错误信息 =", res2.body.error);

  // ========== 场景5：接口路径错误（返回空 200，如 Base URL 缺 /v1）——应提示检查地址 ==========
  process.env.WORKSHOP_AI_CHAT_URL = "http://127.0.0.1:4715/chat/completions";
  const emptyAi = http.createServer((req, res) => { res.statusCode = 200; res.end(""); });
  await new Promise(r => emptyAi.listen(4715, "127.0.0.1", r));
  const res3 = { statusCode: 0, setHeader() {}, end(v) { this.body = JSON.parse(v); } };
  await handler({ method: "POST", query: { path: "generate" }, headers: { "x-forwarded-for": "7.7.7.7" }, socket: {}, body: { prompt: "三年级数学", grade: "三年级", subject: "数学" } }, res3);
  assert.equal(res3.statusCode, 502);
  assert.ok(res3.body.error.includes("/v1"));
  console.log("场景5【空响应提示】：状态 =", res3.statusCode, "| 错误信息 =", res3.body.error);
  mockAi.close(); badAi.close(); emptyAi.close();
}
console.log("\n全部场景通过。");
