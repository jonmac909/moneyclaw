/**
 * MoneyClaw chat-forwarder
 *
 * Bridges data/chat.json <-> fakechat plugin WebSocket (ws://127.0.0.1:8787/ws).
 * Run with bun: `bun run chat-forwarder.js`
 */

const path = require("path");
const fs = require("fs");

const CHAT_FILE = process.env.CHAT_FILE || path.join(__dirname, "data", "chat.json");
const FAKECHAT_WS = process.env.FAKECHAT_WS || "ws://127.0.0.1:8787/ws";

let lastId = null;
let initialized = false;
let ws = null;

function log(...a) { console.log("[forwarder]", ...a); }

function writeAtomic(msgs) {
  const tmp = CHAT_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(msgs, null, 2));
  fs.renameSync(tmp, CHAT_FILE);
}

function connect() {
  ws = new WebSocket(FAKECHAT_WS);
  ws.onopen = () => log("connected to fakechat");
  ws.onclose = () => {
    log("disconnected — retrying in 2s");
    setTimeout(connect, 2000);
  };
  ws.onerror = (e) => log("ws error", e?.message || "");
  ws.onmessage = (evt) => {
    try {
      const m = JSON.parse(evt.data);
      if (m.type === "msg" && m.from === "assistant") {
        const msgs = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
        if (!msgs.some((x) => x.id === m.id)) {
          msgs.push({
            id: m.id,
            text: m.text,
            sender: "agent",
            timestamp: Date.now(),
          });
          writeAtomic(msgs);
          log("appended assistant reply", m.id);
        }
      }
    } catch (e) {
      log("onmessage error", e.message);
    }
  };
}

function poll() {
  try {
    const msgs = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    if (!initialized) {
      initialized = true;
      lastId = msgs.length ? msgs[msgs.length - 1].id : null;
      return;
    }
    // If file was cleared, reset lastId so new messages are treated as new
    if (!msgs.length) { lastId = null; return; }
    let found = lastId === null; // when lastId is null, treat all as new
    for (const m of msgs) {
      if (!found) {
        if (m.id === lastId) found = true;
        continue;
      }
      if (m.sender === "user") {
        if (ws && ws.readyState === 1 /* OPEN */) {
          ws.send(JSON.stringify({ id: m.id, text: m.text }));
          log("forwarded to fakechat", m.id);
          lastId = m.id;
        } else {
          // ws not ready — stop here and retry this message on next poll
          break;
        }
      } else {
        // agent message — already handled via ws.onmessage, just track
        lastId = m.id;
      }
    }
  } catch (e) { /* file may not exist yet */ }
}

connect();
setInterval(poll, 1000);
log("watching", CHAT_FILE);
