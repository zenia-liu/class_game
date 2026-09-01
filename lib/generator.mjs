import { randomBytes } from "node:crypto";

export function safeText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

function inferMeta(prompt) {
  const text = prompt.toLowerCase();
  const gradeMatch = prompt.match(/([一二三四五六1-6])年级/);
  const gradeMap = { "1": "一年级", "2": "二年级", "3": "三年级", "4": "四年级", "5": "五年级", "6": "六年级" };
  const grade = gradeMatch ? (gradeMap[gradeMatch[1]] || `${gradeMatch[1]}年级`) : "三年级";
  let subject = "综合";
  if (/数学|乘|除|加|减|分数|小数|周长|面积|口算/.test(text)) subject = "数学";
  else if (/英语|english|word|单词|food|animal/.test(text)) subject = "英语";
  else if (/语文|古诗|课文|词语|阅读|汉字/.test(text)) subject = "语文";
  else if (/科学|实验|植物|动物|物质|地球/.test(text)) subject = "科学";
  return { subject, grade, knowledgePoint: safeText(prompt, 80) || "课堂复习" };
}

export function demoPack(prompt = "三年级两位数乘一位数") {
  const meta = inferMeta(prompt);
  const id = () => randomBytes(5).toString("hex");
  if (meta.subject === "数学") {
    const equations = [[23, 3], [14, 4], [32, 2], [21, 4], [12, 6], [31, 3], [24, 2], [13, 5], [22, 4], [16, 3], [15, 5], [34, 2]];
    const quizItems = equations.map(([a, b], index) => {
      const answer = a * b;
      const options = [answer, answer + b, answer - b, answer + 10].sort((x, y) => ((index * 7 + x) % 11) - ((index * 7 + y) % 11)).map(String);
      return { id: id(), type: "choice", prompt: `${a} × ${b} = ?`, options, answer: String(answer), explanation: `${a}个${b}相加，结果是${answer}。` };
    });
    return {
      meta: { ...meta, title: "两位数乘一位数挑战", source: "demo" }, quizItems,
      pairs: equations.slice(0, 8).map(([a, b]) => ({ id: id(), left: `${a} × ${b}`, right: String(a * b) })),
      cards: equations.concat([[18, 4], [11, 7], [25, 3], [17, 2]]).slice(0, 16).map(([a, b]) => ({ id: id(), text: `${a} × ${b}`, answer: String(a * b) }))
    };
  }
  const english = [
    ["apple", "苹果"], ["rice", "米饭"], ["noodles", "面条"], ["milk", "牛奶"], ["bread", "面包"], ["fish", "鱼"],
    ["egg", "鸡蛋"], ["juice", "果汁"], ["banana", "香蕉"], ["water", "水"], ["chicken", "鸡肉"], ["vegetable", "蔬菜"]
  ];
  if (meta.subject === "英语") {
    return {
      meta: { ...meta, title: "Food 食物单词挑战", source: "demo" },
      quizItems: english.slice(0, 10).map(([word, meaning], index) => {
        const wrong = english.filter((_, itemIndex) => itemIndex !== index).slice((index + 2) % 6, (index + 2) % 6 + 3).map(item => item[1]);
        return { id: id(), type: "choice", prompt: `“${word}”是什么意思？`, options: [meaning, ...wrong].slice(0, 4).sort(), answer: meaning, explanation: `${word}：${meaning}` };
      }),
      pairs: english.slice(0, 8).map(([left, right]) => ({ id: id(), left, right })),
      cards: english.map(([text, answer]) => ({ id: id(), text, answer }))
    };
  }
  const topic = meta.knowledgePoint.replace(/给.*?学生|复习|根据|出.*?题/g, "").trim() || "本课知识点";
  const stems = ["核心概念是什么？", "下面哪项说法最恰当？", "学习时最需要注意什么？", "请判断这一知识点的正确表述。", "它可以应用在哪种情境？", "请选出相关的关键词。", "下面哪项不符合要求？", "请完成这条知识小结。", "哪一项最能说明它的特点？", "请找出正确的学习方法。"];
  return {
    meta: { ...meta, title: `${topic}课堂挑战`, source: "demo" },
    quizItems: stems.map(stem => ({ id: id(), type: "choice", prompt: `${topic}：${stem}`, options: ["请结合教材确认", "与主题无关", "表述不完整", "无法判断"], answer: "请结合教材确认", explanation: "当前未配置 AI 服务，这是结构演示题，请由老师修改后使用。" })),
    pairs: Array.from({ length: 8 }, (_, index) => ({ id: id(), left: `${topic}要点${index + 1}`, right: `请补充对应内容${index + 1}` })),
    cards: Array.from({ length: 16 }, (_, index) => ({ id: id(), text: `${topic}知识卡${index + 1}`, answer: "请补充答案" }))
  };
}

function normalizeQuizItems(list) {
  return Array.isArray(list) ? list.slice(0, 20).map((item, index) => ({
    id: safeText(item.id, 40) || `q-${index}-${randomBytes(3).toString("hex")}`,
    type: ["choice", "judge", "short"].includes(item.type) ? item.type : "choice",
    prompt: safeText(item.prompt, 300), options: Array.isArray(item.options) ? item.options.slice(0, 4).map(option => safeText(option, 100)) : [],
    answer: safeText(item.answer, 150), explanation: safeText(item.explanation, 300)
  })).filter(item => item.prompt && item.answer) : [];
}

function normalizePairs(list) {
  return Array.isArray(list) ? list.slice(0, 12).map((item, index) => ({ id: `p-${index}-${randomBytes(3).toString("hex")}`, left: safeText(item.left, 100), right: safeText(item.right, 100) })).filter(item => item.left && item.right) : [];
}

function normalizeCards(list) {
  return Array.isArray(list) ? list.slice(0, 20).map((item, index) => ({ id: `c-${index}-${randomBytes(3).toString("hex")}`, text: safeText(item.text, 120), answer: safeText(item.answer, 120) })).filter(item => item.text) : [];
}

function normalizePack(value, prompt) {
  const fallback = demoPack(prompt);
  const meta = { ...fallback.meta, ...(value?.meta || {}), source: "ai" };
  const quizItems = normalizeQuizItems(value?.quizItems);
  const pairs = normalizePairs(value?.pairs);
  const cards = normalizeCards(value?.cards);
  return { meta, quizItems: quizItems.length ? quizItems : fallback.quizItems, pairs: pairs.length ? pairs : fallback.pairs, cards: cards.length ? cards : fallback.cards };
}

export function aiAvailable() {
  return Boolean(process.env.WORKSHOP_AI_API_KEY);
}

function extractJson(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

async function callAi({ chatUrl, apiKey, model, system, user }) {
  const requestBody = { model, temperature: 0.4, max_tokens: Math.min(Number(process.env.WORKSHOP_AI_MAX_TOKENS) || 8000, 8192), messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  if (process.env.WORKSHOP_AI_JSON_MODE !== "false") requestBody.response_format = { type: "json_object" };
  let response;
  try {
    response = await fetch(chatUrl, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(requestBody), signal: AbortSignal.timeout(52000)
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") throw new Error("AI 响应超时（52秒）。当前模型生成较慢，请减少题量重试，或换用更快的模型（如 flash 系列）");
    throw new Error(`无法连接 AI 服务：${error.message}`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI 服务返回 ${response.status}${detail ? `：${safeText(detail, 160)}` : ""}`);
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("AI 接口返回了空内容或非 JSON 数据，请检查 Base URL 是否正确（通常需要以 /v1 结尾）"); }
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error("AI 没有返回题目");
  if (choice?.finish_reason === "length") throw new Error("AI 回复超长被截断，请减少题量后重试");
  try { return JSON.parse(extractJson(content)); }
  catch { throw new Error("AI 返回的题目格式不完整，请重试一次或减少题量"); }
}

const PART_KEYS = ["quiz", "quiz1", "quiz2", "pairs", "cards"];

export async function generatePack(prompt, options = {}) {
  const part = PART_KEYS.includes(options.part) ? options.part : "";
  const apiKey = process.env.WORKSHOP_AI_API_KEY || "";
  if (!apiKey) {
    const pack = demoPack(prompt);
    const notice = "当前未配置AI服务，已生成演示题目。配置服务端Key后即可真实出题。";
    if (!part) return { pack, mode: "demo", notice };
    if (part.startsWith("quiz")) {
      const partIndex = Math.max(Number(options.partIndex) || (part === "quiz2" ? 2 : 1), 1);
      const size = Math.min(Math.max(Number(options.partCount) || 5, 2), 8);
      const slice = pack.quizItems.slice((partIndex - 1) * size, partIndex * size);
      return { part, data: { meta: pack.meta, quizItems: slice.length ? slice : pack.quizItems.slice(0, size) }, mode: "demo", notice };
    }
    return { part, data: part === "pairs" ? { pairs: pack.pairs } : { cards: pack.cards }, mode: "demo", notice };
  }
  const baseUrl = (process.env.WORKSHOP_AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const chatUrl = process.env.WORKSHOP_AI_CHAT_URL || `${baseUrl}/chat/completions`;
  const model = process.env.WORKSHOP_AI_MODEL || "deepseek-chat";
  const grade = safeText(options.grade, 10) || "小学";
  const subject = safeText(options.subject, 10);
  const count = Math.min(Math.max(Number(options.count) || 10, 4), 20);
  const audience = `面向${grade}${subject ? `${subject}课` : ""}，题目难度和知识范围要符合中国义务教育课程标准中该年级的要求。若老师提供了教材原文或已有题目，优先基于这些材料出题；材料不足时使用常识范围但不要虚构出处。答案必须准确。`;
  const quizSchema = `你是小学教师的出题助手。请严格返回一个 JSON 对象，不要使用 Markdown。对象结构：
{"meta":{"title":"","subject":"语文/数学/英语/科学/综合","grade":"一年级至六年级","knowledgePoint":""},"quizItems":[{"type":"choice","prompt":"","options":["","","",""] ,"answer":"必须与某个选项完全一致","explanation":"一句话"}]}`;
  if (part.startsWith("quiz")) {
    const partTotal = Math.min(Math.max(Number(options.partTotal) || 2, 1), 5);
    const partIndex = Math.min(Math.max(Number(options.partIndex) || (part === "quiz2" ? 2 : 1), 1), partTotal);
    const partCount = Math.min(Math.max(Number(options.partCount) || Math.ceil(count / 2), 2), 8);
    const focusList = ["侧重基础概念和直接运用", "侧重实际应用和情景题", "侧重易错点辨析和判断", "题型多样，综合运用", "拓展提升，稍有挑战但不超纲"];
    const focus = partTotal > 1 ? `这是同一批题的第${partIndex}部分（共${partTotal}部分），${focusList[(partIndex - 1) % focusList.length]}，避免与其他部分重复出题` : "";
    const system = `${quizSchema}
要求：${audience}共生成${partCount}道不重复、无歧义、不过度刁钻的选择题或判断题${focus ? `（${focus}）` : ""}，每题必须给出 options、answer 和 explanation，answer 必须与某个选项文字完全一致。`;
    const parsed = await callAi({ chatUrl, apiKey, model, system, user: prompt });
    const quizItems = normalizeQuizItems(parsed?.quizItems);
    if (!quizItems.length) throw new Error("AI 返回的选择题不完整，请重试");
    return { part, data: { meta: { ...demoPack(prompt).meta, ...(parsed?.meta || {}), source: "ai" }, quizItems }, mode: "ai" };
  }
  if (part === "pairs") {
    const system = `你是小学教师的出题助手。请严格返回一个 JSON 对象，不要使用 Markdown。对象结构：
{"pairs":[{"left":"","right":""}]}
要求：${audience}生成 8 对可互相对应的配对卡（如算式与得数、单词与释义、术语与含义），左右两列文字都要简短。`;
    const parsed = await callAi({ chatUrl, apiKey, model, system, user: prompt });
    const pairs = normalizePairs(parsed?.pairs);
    if (pairs.length < 2) throw new Error("AI 返回的配对卡不完整，请重试");
    return { part, data: { pairs }, mode: "ai" };
  }
  if (part === "cards") {
    const system = `你是小学教师的出题助手。请严格返回一个 JSON 对象，不要使用 Markdown。对象结构：
{"cards":[{"text":"","answer":""}]}
要求：${audience}生成 16 个适合课堂朗读或口答的简短知识卡，text 是题面，answer 是参考答案。`;
    const parsed = await callAi({ chatUrl, apiKey, model, system, user: prompt });
    const cards = normalizeCards(parsed?.cards);
    if (cards.length < 4) throw new Error("AI 返回的知识卡不完整，请重试");
    return { part, data: { cards }, mode: "ai" };
  }
  const quizSystem = `${quizSchema}
要求：${audience}共生成${count}道不重复、无歧义、不过度刁钻的选择题或判断题，每题必须给出 options、answer 和 explanation，answer 必须与某个选项文字完全一致。`;
  const cardSystem = `你是小学教师的出题助手。请严格返回一个 JSON 对象，不要使用 Markdown。对象结构：
{"pairs":[{"left":"","right":""}],"cards":[{"text":"","answer":""}]}
要求：${audience}pairs 生成 8 对可互相对应的配对卡（如算式与得数、单词与释义）；cards 生成 16 个适合朗读或口答的简短知识卡，text 是题面，answer 是参考答案。`;
  const [quizResult, cardResult] = await Promise.allSettled([
    callAi({ chatUrl, apiKey, model, system: quizSystem, user: prompt }),
    callAi({ chatUrl, apiKey, model, system: cardSystem, user: prompt })
  ]);
  if (quizResult.status === "rejected") throw quizResult.reason;
  const merged = { ...quizResult.value, ...(cardResult.status === "fulfilled" ? cardResult.value : {}) };
  const notice = cardResult.status === "fulfilled" ? "题目已生成，请务必检查答案。" : "选择题已生成；配对卡和知识卡这次生成失败，已用演示内容占位，可重新生成或手动编辑。";
  return { pack: normalizePack(merged, prompt), mode: "ai", notice };
}
