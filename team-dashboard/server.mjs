import http from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DIST = path.join(HERE, "dist");
const HOST = "127.0.0.1";
const PORT = Number(process.env.TEAM_DASHBOARD_PORT || 4173);
const CODEX_BIN = "/Applications/ChatGPT.app/Contents/Resources/codex";

const agents = {
  producer: { name: "Мира", role: "Продюсер", skill: "social-producer" },
  researcher: { name: "Лекс", role: "Исследователь", skill: "audience-researcher" },
  strategist: { name: "Софи", role: "Маркетинг-стратег", skill: "marketing-strategist" },
  smm: { name: "Нова", role: "SMM-стратег", skill: "smm-strategist" },
  copywriter: { name: "Макс", role: "Копирайтер", skill: "social-copywriter" },
  reels: { name: "Рэй", role: "Reels-сценарист", skill: "reels-scriptwriter" },
  visual: { name: "Итан", role: "Визуальный продюсер", skill: "visual-producer" },
  guardian: { name: "Грейс", role: "Brand Guardian", skill: "brand-guardian" },
  analyst: { name: "Алекс", role: "Аналитик", skill: "social-analyst" },
};

const sourceFiles = {
  brief: "knowledge/brand-brief.md",
  product: "knowledge/product.md",
  audience: "knowledge/audience.md",
  voice: "knowledge/voice.md",
  strategy: "knowledge/strategy.md",
  evidence: "knowledge/evidence.md",
  calendar: "operations/content-calendar.md",
  content: "operations/content-registry.md",
  decisions: "operations/decisions.md",
  feedback: "operations/feedback-log.md",
  analytics: "operations/analytics.md",
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

function statusFrom(markdown) {
  return markdown.match(/Статус:\s*`([^`]+)`/i)?.[1] || "not_started";
}

function markdownTableRows(markdown) {
  const rows = markdown.split("\n").filter((line) => /^\|.*\|$/.test(line.trim()));
  if (rows.length < 3) return [];
  const headers = rows[0].split("|").slice(1, -1).map((v) => v.trim());
  return rows.slice(2).filter((row) => !/^\|[\s|:-]+\|$/.test(row)).map((row) => {
    const values = row.split("|").slice(1, -1).map((v) => v.trim());
    return Object.fromEntries(headers.map((key, index) => [key, values[index] || ""]));
  });
}

async function loadState() {
  const entries = await Promise.all(Object.entries(sourceFiles).map(async ([key, relativePath]) => {
    const markdown = await readFile(path.join(ROOT, relativePath), "utf8").catch(() => "");
    return [key, { path: relativePath, status: statusFrom(markdown), markdown }];
  }));
  const files = Object.fromEntries(entries);
  return {
    updatedAt: new Date().toISOString(),
    files,
    calendarRows: markdownTableRows(files.calendar.markdown),
    contentRows: markdownTableRows(files.content.markdown),
    analyticsRows: markdownTableRows(files.analytics.markdown),
  };
}

function buildPrompt(agent, message, history) {
  const transcript = history.slice(-8).map((item) => `${item.role === "user" ? "Пользователь" : agent.name}: ${item.text}`).join("\n");
  return [
    `Используй skill $${agent.skill} и его профессиональные правила.`,
    `Ты ${agent.name}, роль: ${agent.role}, участник AI-команды продвижения пользователя.`,
    "Прочитай только нужные файлы общей памяти в knowledge/ и operations/ перед ответом.",
    "Сейчас ты работаешь в режиме консультации: не изменяй файлы и не запускай действия, меняющие проект.",
    "Отвечай по-русски, конкретно и профессионально. Отделяй подтверждённые данные от гипотез.",
    "Если данных не хватает, задай один наиболее важный вопрос. Не изображай завершённую работу, которой нет.",
    transcript ? `Недавний диалог:\n${transcript}` : "Диалог только начался.",
    `Новое сообщение пользователя:\n${message}`,
  ].join("\n\n");
}

function runAgent(agent, message, history) {
  return new Promise((resolve, reject) => {
    const args = ["-C", ROOT, "-s", "read-only", "-a", "never", "exec", "--json", "--ephemeral", buildPrompt(agent, message, history)];
    const child = spawn(CODEX_BIN, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Агент отвечает дольше двух минут. Попробуйте ещё раз."));
    }, 120_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr.trim() || `Codex завершился с кодом ${code}`));
      const events = stdout.split("\n").filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
      const messages = events
        .filter((event) => event.type === "item.completed" && event.item?.type === "agent_message")
        .map((event) => event.item.text)
        .filter(Boolean);
      const fallback = [...events].reverse().find((event) => typeof event.message === "string")?.message;
      resolve(messages.at(-1) || fallback || "Ответ получен, но локальный адаптер не смог распознать его формат.");
    });
  });
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) throw new Error("Слишком длинное сообщение");
  }
  return JSON.parse(body || "{}");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);
    if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, await loadState());
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const { agentId, message, history = [] } = await readBody(req);
      const agent = agents[agentId];
      if (!agent) return send(res, 400, { error: "Неизвестный специалист" });
      if (typeof message !== "string" || !message.trim() || message.length > 6000) return send(res, 400, { error: "Проверьте текст сообщения" });
      const reply = await runAgent(agent, message.trim(), Array.isArray(history) ? history : []);
      return send(res, 200, { reply, agent });
    }

    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const filePath = path.resolve(DIST, requested);
    if (!filePath.startsWith(DIST + path.sep) && filePath !== path.join(DIST, "index.html")) return send(res, 403, "Forbidden", "text/plain");
    const body = await readFile(filePath);
    send(res, 200, body, mime[path.extname(filePath)] || "application/octet-stream");
  } catch (error) {
    const code = error?.code === "ENOENT" ? 404 : 500;
    send(res, code, { error: error.message || "Внутренняя ошибка" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AI Team HQ: http://${HOST}:${PORT}`);
  console.log(`Workspace: ${ROOT}`);
});
