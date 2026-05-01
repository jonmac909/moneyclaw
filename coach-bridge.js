/**
 * MoneyClaw coach-bridge
 *
 * Watches data/chat.json for trailing user messages with no agent reply,
 * invokes `claude -p` with coach-prompt.md as the system prompt, and
 * appends the reply back to chat.json. Run with node.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHAT_FILE = process.env.CHAT_FILE || path.join(__dirname, "data", "chat.json");
const PROMPT_FILE = path.join(__dirname, "coach-prompt.md");
const WORKDIR = __dirname;
const POLL_MS = 2000;
const HISTORY_TURNS = 10;

let processing = false;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), "[coach]", ...a);

const readChat = () => {
  try { return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")); } catch (_) { return []; }
};

const writeChat = (msgs) => {
  const tmp = CHAT_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(msgs, null, 2));
  fs.renameSync(tmp, CHAT_FILE);
};

const appendMessage = (msg) => {
  const current = readChat();
  current.push(msg);
  writeChat(current);
};

const makeId = (suffix = "") =>
  "msg-" + Date.now() + "-" + (suffix || Math.random().toString(36).slice(2, 8));

function callClaude(userText, history) {
  const recent = history.slice(-HISTORY_TURNS);
  const transcript = recent
    .map(m => `${m.sender === "user" ? "User" : "Coach"}: ${m.text}`)
    .join("\n");
  const prompt = (transcript ? `Recent conversation:\n${transcript}\n\n` : "")
    + `User message:\n${userText}\n\nRespond as MoneyClaw Coach. Output only the reply text, no meta-commentary.`;
  const systemPrompt = fs.readFileSync(PROMPT_FILE, "utf8");

  return new Promise((resolve, reject) => {
    const args = [
      "-p", prompt,
      "--append-system-prompt", systemPrompt,
      "--add-dir", WORKDIR,
    ];
    if (process.env.MONEYCLAW_COACH_BYPASS_PERMISSIONS === "1") {
      args.push("--permission-mode", "bypassPermissions");
    }
    log("invoking claude CLI (prompt chars:", prompt.length + ")");
    const child = spawn("claude", args, { cwd: WORKDIR, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${(err || out).slice(0, 500)}`));
      resolve(out.trim());
    });
  });
}

async function tick() {
  if (processing) return;
  const msgs = readChat();
  if (!msgs.length) return;
  const last = msgs[msgs.length - 1];
  if (last.sender !== "user") return;

  processing = true;
  try {
    log("new user message:", JSON.stringify(last.text.slice(0, 80)));
    const t0 = Date.now();
    const reply = await callClaude(last.text, msgs.slice(0, -1));
    log(`reply in ${((Date.now() - t0) / 1000).toFixed(1)}s, chars: ${reply.length}`);
    appendMessage({
      id: makeId(),
      text: reply || "(empty response)",
      sender: "agent",
      timestamp: Date.now(),
    });
  } catch (e) {
    log("ERROR:", e.message);
    appendMessage({
      id: makeId("err"),
      text: "⚠️ Coach error: " + e.message,
      sender: "agent",
      timestamp: Date.now(),
    });
  } finally {
    processing = false;
  }
}

log("watching", CHAT_FILE);
setInterval(tick, POLL_MS);
tick();
