import assert from "node:assert/strict";
import { buildGameHtml, GAME_NAMES } from "../public/game-builder.js";

const pack = {
  meta: { title: "离线验证课", subject: "数学", grade: "三年级", knowledgePoint: "乘法" },
  quizItems: [
    { id: "q1", type: "choice", prompt: "3 × 4 = ?", options: ["7", "12", "14", "16"], answer: "12", explanation: "三个4是12。" },
    { id: "q2", type: "choice", prompt: "5 × 6 = ?", options: ["11", "25", "30", "35"], answer: "30", explanation: "五个6是30。" }
  ],
  pairs: [
    { id: "p1", left: "3 × 4", right: "12" }, { id: "p2", left: "5 × 6", right: "30" },
    { id: "p3", left: "2 × 8", right: "16" }, { id: "p4", left: "7 × 3", right: "21" }
  ],
  cards: Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, text: `${index + 2} × 2`, answer: String((index + 2) * 2) }))
};

for (const gameType of Object.keys(GAME_NAMES)) {
  const html = buildGameHtml(gameType, pack, { title: `验证-${GAME_NAMES[gameType]}` });
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.includes(`"gameType":"${gameType}"`), `${gameType} 缺少游戏配置`);
  assert.ok(html.includes("课堂桌游"), `${gameType} 缺少离线游戏界面`);
  assert.doesNotMatch(html, /https?:\/\//i, `${gameType} 含外部网络依赖`);
  assert.doesNotMatch(html, /<link\b/i, `${gameType} 含外部样式依赖`);
}

console.log("离线游戏检查通过：4 种模板均为单文件、零外链。");
