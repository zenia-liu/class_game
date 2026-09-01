import { buildGameHtml, GAME_NAMES } from "./game-builder.js";

const state = {
  pack: null,
  gameType: "race",
  editorTab: "quiz",
  currentStep: 1,
  config: null,
  activeView: "create",
  currentLocalProjectId: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const gameDefinitions = [
  { id: "race", emoji: "赛", name: "红蓝竞速闯关", desc: "答对推动队伍前进，适合综合复习", count: () => state.pack?.quizItems?.length || 0, unit: "道问答题", color: "#c44d3b", soft: "#ead7c8" },
  { id: "match", emoji: "连", name: "阵营连连看", desc: "轮流配对，答对得分并继续挑战", count: () => state.pack?.pairs?.length || 0, unit: "组配对", color: "#2f6f68", soft: "#d6e3dc" },
  { id: "memory", emoji: "翻", name: "红蓝翻牌记忆", desc: "翻开卡片寻找知识搭档，锻炼记忆", count: () => state.pack?.pairs?.length || 0, unit: "组配对", color: "#49657a", soft: "#dbe2e5" },
  { id: "mystery", emoji: "谜", name: "神秘格子 PK", desc: "秘密埋下惊喜格，知识与悬念并存", count: () => state.pack?.cards?.length || 0, unit: "张知识卡", color: "#9b742f", soft: "#ebe0bd" }
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "操作没有完成，请稍后再试");
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showToast(message, duration = 2300) {
  const node = $("#siteToast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.classList.remove("show"), duration);
}

function setLoading(show, text = "正在把知识点变成题目…") {
  $("#loadingText").textContent = text;
  $("#loadingLayer").classList.toggle("show", show);
}

function saveDraft() {
  if (!state.pack) return;
  localStorage.setItem("workshop_draft", JSON.stringify({ pack: state.pack, gameType: state.gameType, prompt: $("#promptInput").value, savedAt: Date.now() }));
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem("workshop_draft") || "null");
    if (!saved?.pack || Date.now() - saved.savedAt > 7 * 86400000) return;
    state.pack = saved.pack;
    state.gameType = saved.gameType || "race";
    $("#promptInput").value = saved.prompt || "";
    showToast("已恢复上次未完成的内容");
  } catch {
    localStorage.removeItem("workshop_draft");
  }
}

const LOCAL_PROJECTS_KEY = "workshop_projects";

function loadLocalProjects() {
  try {
    const projects = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || "[]");
    return Array.isArray(projects) ? projects.filter(project => project?.id && project?.pack) : [];
  } catch {
    localStorage.removeItem(LOCAL_PROJECTS_KEY);
    return [];
  }
}

function saveLocalProject() {
  if (!state.pack) return;
  try {
    const projects = loadLocalProjects();
    const id = state.currentLocalProjectId || (crypto.randomUUID?.() || `project-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const project = {
      id,
      title: $("#gameTitleInput").value.trim() || state.pack.meta?.title || "未命名课游",
      gameType: state.gameType,
      pack: state.pack,
      updatedAt: new Date().toISOString()
    };
    const existingIndex = projects.findIndex(item => item.id === id);
    if (existingIndex >= 0) projects.splice(existingIndex, 1);
    projects.unshift(project);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects.slice(0, 20)));
    state.currentLocalProjectId = id;
  } catch {
    showToast("本机存储空间不足，这次制作暂未保存");
  }
}

function switchView(name) {
  $$(".view").forEach(view => view.classList.remove("active"));
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.viewLink === name));
  $(`#${name}View`).classList.add("active");
  state.activeView = name;
  if (name === "my") renderMyView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goStep(step) {
  if (step > 1 && !state.pack) {
    showToast("请先生成题目");
    return;
  }
  state.currentStep = step;
  $$(".maker-card").forEach(card => card.classList.toggle("active", Number(card.dataset.step) === step));
  $$("#stepper li").forEach((item, index) => {
    item.classList.toggle("active", index + 1 === step);
    item.classList.toggle("done", index + 1 < step);
  });
  if (step === 2) renderEditor();
  if (step === 3) renderGamePicker();
  if (step === 4) renderPreview();
  saveDraft();
  document.querySelector(".stepper").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateDetectedTags() {
  const target = $("#detectedTags");
  target.replaceChildren();
  const meta = state.pack?.meta || {};
  [meta.grade, meta.subject, meta.knowledgePoint].filter(Boolean).slice(0, 3).forEach(value => {
    const chip = document.createElement("span");
    chip.textContent = value;
    target.append(chip);
  });
  if (meta.source && meta.source !== "ai") {
    const warn = document.createElement("span");
    warn.className = "tag-warn";
    warn.textContent = "⚠ 演示占位题（AI 未生效，题目是固定模板）";
    target.append(warn);
  }
}

function field(labelText, value, onInput, options = {}) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
  input.value = value || "";
  if (options.placeholder) input.placeholder = options.placeholder;
  input.addEventListener("input", event => { onInput(event.target.value); saveDraft(); });
  label.append(input);
  return label;
}

function renderEditor() {
  if (!state.pack) return;
  updateDetectedTags();
  $("#quizCount").textContent = state.pack.quizItems.length;
  $("#pairCount").textContent = state.pack.pairs.length;
  $("#cardCount").textContent = state.pack.cards.length;
  $$("[data-editor-tab]").forEach(button => button.classList.toggle("active", button.dataset.editorTab === state.editorTab));
  const list = $("#editorList");
  list.replaceChildren();
  const key = state.editorTab === "quiz" ? "quizItems" : state.editorTab;
  const items = state.pack[key];
  items.forEach((item, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = "editor-item";
    const number = document.createElement("span");
    number.className = "item-number";
    number.textContent = index + 1;
    const remove = document.createElement("button");
    remove.className = "delete-item";
    remove.type = "button";
    remove.title = "删除这一项";
    remove.textContent = "⌫";
    remove.addEventListener("click", () => {
      items.splice(index, 1);
      renderEditor();
      saveDraft();
    });
    const grid = document.createElement("div");
    grid.className = `field-grid ${state.editorTab === "pairs" ? "pair" : ""}`;
    if (state.editorTab === "quiz") {
      grid.append(field("题目", item.prompt, value => { item.prompt = value; }, { multiline: true }));
      grid.append(field("正确答案", item.answer, value => { item.answer = value; }));
      const opts = field("选项（用 | 分开）", (item.options || []).join(" | "), value => { item.options = value.split("|").map(v => v.trim()).filter(Boolean); });
      opts.className = "options-edit";
      grid.append(opts);
    } else if (state.editorTab === "pairs") {
      grid.append(field("左侧内容", item.left, value => { item.left = value; }));
      grid.append(field("对应内容", item.right, value => { item.right = value; }));
    } else {
      grid.append(field("知识卡正面", item.text, value => { item.text = value; }));
      grid.append(field("参考答案", item.answer, value => { item.answer = value; }));
    }
    wrapper.append(number, grid, remove);
    list.append(wrapper);
  });
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "这里还没有内容，点击下方按钮添加。";
    list.append(empty);
  }
}

function addEditorItem() {
  if (!state.pack) return;
  const id = `manual-${Date.now()}`;
  if (state.editorTab === "quiz") state.pack.quizItems.push({ id, type: "choice", prompt: "新题目", options: ["正确选项", "选项二", "选项三", "选项四"], answer: "正确选项", explanation: "" });
  else if (state.editorTab === "pairs") state.pack.pairs.push({ id, left: "左侧内容", right: "对应内容" });
  else state.pack.cards.push({ id, text: "知识卡", answer: "参考答案" });
  renderEditor();
  saveDraft();
  $("#editorList").scrollTop = $("#editorList").scrollHeight;
}

async function generatePack() {
  const prompt = $("#promptInput").value.trim();
  if (prompt.length < 2) {
    showToast("请先告诉我今天想让学生练什么");
    $("#promptInput").focus();
    return;
  }
  setLoading(true);
  try {
    const result = await api("/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, grade: $("#gradeSelect").value, subject: $("#subjectSelect").value, count: Number($("#countSelect").value) })
    });
    state.pack = result.pack;
    state.currentLocalProjectId = null;
    if ($("#gradeSelect").value) state.pack.meta.grade = $("#gradeSelect").value;
    if ($("#subjectSelect").value) state.pack.meta.subject = $("#subjectSelect").value;
    $("#gameTitleInput").value = state.pack.meta.title || "课堂挑战";
    saveDraft();
    goStep(2);
    showToast(result.notice || "题目已生成，请检查答案");
  } catch (error) {
    if (error.payload?.fallback) {
      state.pack = error.payload.fallback;
      goStep(2);
      showToast(`${error.message}。已临时载入演示占位题（非AI生成），建议重新点击生成`, 6000);
    } else showToast(error.message, 5000);
  } finally {
    setLoading(false);
  }
}

function renderGamePicker() {
  const picker = $("#gamePicker");
  picker.replaceChildren();
  gameDefinitions.forEach(definition => {
    const button = document.createElement("button");
    button.className = `game-choice ${state.gameType === definition.id ? "selected" : ""}`;
    button.style.setProperty("--game-color", definition.color);
    button.style.setProperty("--game-soft", definition.soft);
    const emoji = document.createElement("span");
    emoji.className = "game-emoji";
    emoji.textContent = definition.emoji;
    const title = document.createElement("h3");
    title.textContent = definition.name;
    const desc = document.createElement("p");
    desc.textContent = definition.desc;
    const count = document.createElement("small");
    count.textContent = `${definition.count()} ${definition.unit}`;
    button.append(emoji, title, desc, count);
    button.addEventListener("click", () => {
      state.gameType = definition.id;
      renderGamePicker();
      saveDraft();
    });
    picker.append(button);
  });
  if (!$("#gameTitleInput").value) $("#gameTitleInput").value = state.pack?.meta?.title || "课堂挑战";
}

function validateForGame() {
  if (!state.pack) return "请先生成题目";
  if (state.gameType === "race" && !state.pack.quizItems.length) return "竞速闯关至少需要1道问答题";
  if (["match", "memory"].includes(state.gameType) && state.pack.pairs.length < 2) return "这个玩法至少需要2组配对卡";
  if (state.gameType === "mystery" && state.pack.cards.length < 4) return "神秘格子至少需要4张知识卡";
  return "";
}

function currentGameHtml(pack = state.pack, gameType = state.gameType, title = $("#gameTitleInput").value.trim()) {
  return buildGameHtml(gameType, pack, { title: title || pack?.meta?.title || "课堂挑战" });
}

function renderPreview() {
  const error = validateForGame();
  if (error) {
    showToast(error);
    goStep(3);
    return;
  }
  $("#previewFrame").srcdoc = currentGameHtml();
  saveLocalProject();
}

function downloadGame() {
  saveLocalProject();
  const html = currentGameHtml();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const title = ($("#gameTitleInput").value.trim() || "课堂游戏").replace(/[\\/:*?"<>|]/g, "-");
  anchor.href = url;
  anchor.download = `${title}-${GAME_NAMES[state.gameType]}.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("离线游戏已下载，可以直接双击打开");
}

const coverThemes = {
  race: ["#c75b45", "#ead8c6", "赛"], match: ["#2f7169", "#dbe5dc", "连"], memory: ["#49687a", "#dce3e4", "翻"], mystery: ["#a67d32", "#ebe0bd", "谜"]
};

function formatProjectTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚更新";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} 更新`;
}

function restoreProject(project, targetStep = 2) {
  state.pack = structuredClone(project.pack);
  state.gameType = project.gameType;
  state.currentLocalProjectId = project.local ? project.id : null;
  $("#gameTitleInput").value = project.title || project.pack.meta?.title || "课堂挑战";
  switchView("create");
  goStep(targetStep);
  showToast(targetStep === 4 ? "已打开课游，可以开始试玩" : "已载入，可以继续修改");
}

function projectCard(project) {
  const theme = coverThemes[project.gameType] || coverThemes.race;
  const card = document.createElement("article");
  card.className = "my-card";
  const cover = document.createElement("div");
  cover.className = "my-card-cover";
  cover.style.setProperty("--cover-a", theme[0]);
  cover.style.setProperty("--cover-b", theme[1]);
  const mark = document.createElement("span"); mark.textContent = theme[2];
  const kind = document.createElement("small"); kind.textContent = GAME_NAMES[project.gameType] || "课堂游戏";
  cover.append(mark, kind);
  const body = document.createElement("div"); body.className = "my-card-body";
  const tags = document.createElement("div"); tags.className = "work-tags";
  [project.pack?.meta?.subject || project.subject, project.pack?.meta?.grade || project.grade].filter(Boolean).forEach(value => {
    const tag = document.createElement("span"); tag.textContent = value; tags.append(tag);
  });
  const title = document.createElement("h3"); title.textContent = project.title;
  const meta = document.createElement("p"); meta.className = "my-card-meta";
  meta.textContent = formatProjectTime(project.updatedAt);
  const actions = document.createElement("div"); actions.className = "my-actions";
  const edit = document.createElement("button"); edit.className = "secondary-button"; edit.textContent = "继续编辑";
  edit.addEventListener("click", () => restoreProject({ ...project, local: true }, 2));
  const play = document.createElement("button"); play.className = "ghost-button"; play.textContent = "试玩";
  play.addEventListener("click", () => restoreProject({ ...project, local: true }, 4));
  const remove = document.createElement("button"); remove.className = "danger-button"; remove.textContent = "删除";
  remove.addEventListener("click", () => {
    if (!window.confirm(`确定删除本机记录“${project.title}”吗？`)) return;
    const projects = loadLocalProjects().filter(item => item.id !== project.id);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
    if (state.currentLocalProjectId === project.id) state.currentLocalProjectId = null;
    renderLocalProjects();
    showToast("已删除本机记录");
  });
  actions.append(edit, play, remove);
  body.append(tags, title, meta, actions); card.append(cover, body);
  return card;
}

function renderLocalProjects() {
  const grid = $("#localProjectGrid");
  const projects = loadLocalProjects();
  grid.replaceChildren();
  if (!projects.length) {
    grid.innerHTML = '<div class="empty-projects"><strong>还没有本机制作记录</strong><p>完成一次游戏预览后，会自动保存在这里。</p><button class="secondary-button" data-empty-create>开始制作</button></div>';
    grid.querySelector("[data-empty-create]").addEventListener("click", () => switchView("create"));
    return;
  }
  projects.forEach(project => grid.append(projectCard(project)));
}

function renderMyView() {
  renderLocalProjects();
}

function bindEvents() {
  $$('[data-view-link]').forEach(button => button.addEventListener("click", event => { event.preventDefault(); switchView(button.dataset.viewLink); }));
  $$('[data-example]').forEach(button => button.addEventListener("click", () => { $("#promptInput").value = button.dataset.example; $("#promptInput").focus(); }));
  $$('[data-go-step]').forEach(button => button.addEventListener("click", () => goStep(Number(button.dataset.goStep))));
  $$("[data-editor-tab]").forEach(button => button.addEventListener("click", () => { state.editorTab = button.dataset.editorTab; renderEditor(); }));
  $("#generateButton").addEventListener("click", generatePack);
  $("#promptInput").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") generatePack(); });
  $("#addItemButton").addEventListener("click", addEditorItem);
  $("#previewButton").addEventListener("click", () => goStep(4));
  $("#downloadButton").addEventListener("click", downloadGame);
  $("#gameTitleInput").addEventListener("input", saveDraft);
}

async function init() {
  bindEvents();
  restoreDraft();
  try {
    const config = await api("/api/config");
    state.config = config;
    const status = $("#serviceStatus");
    status.classList.add(config.aiAvailable ? "ready" : "demo");
    status.lastChild.textContent = config.aiAvailable ? "智能出题服务已连接" : "演示模式 · 可随时接入国内模型";
  } catch {
    $("#serviceStatus").lastChild.textContent = "本地基础功能可用";
  }
}

init();
