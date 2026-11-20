import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
getDatabase, ref, push, set, remove, onValue, onDisconnect, serverTimestamp, query, limitToLast
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

const firebaseConfig = {
apiKey: "AIzaSyAn06v2-5QKASkAObavHcbmofg39Wm8V-c",
authDomain: "yappify-b9b5e.firebaseapp.com",
databaseURL: "https://yappify-b9b5e-default-rtdb.asia-southeast1.firebasedatabase.app",
projectId: "yappify-b9b5e",
storageBucket: "yappify-b9b5e.firebasestorage.app",
messagingSenderId: "397289116851",
appId: "1:397289116851:web:0800b4ae59d77220308cc6"
};

const ROOM = "public-lobby";
const IMAGE_HOST_KEY = "726fbbd12de1823c568d55f0be750282";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MESSAGES = 250;
const HEARTBEAT_MS = 12000;
const STALE_MS = 35000;
const SEND_COOLDOWN_MS = 2500;
const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const $ = id => document.getElementById(id);
const ui = {
messages: $("messages"), latest: $("latest"), form: $("composer"), input: $("message-input"),
file: $("image-file"), attach: $("attach"), send: $("send"), count: $("online-count"),
dot: $("status-dot"), toasts: $("toasts"), replyPreview: $("reply-preview"),
replyText: $("reply-text"), cancelReply: $("cancel-reply"), imageWrap: $("image-preview-wrap"),
imagePreview: $("image-preview"), imageName: $("image-name"), removeImage: $("remove-image"),
onlineToggle: $("online-toggle"), statusDock: $("status-dock"),
dockOnlineCount: $("dock-online-count"), statMsgs: $("stat-msgs"), statSize: $("stat-size"),
statOffset: $("stat-offset"), statUid: $("stat-uid"), statUsername: $("stat-username"),
statUserDot: $("stat-user-dot"), statHex: $("stat-hex")
};

let db, uid = "", sessionId = createSessionId(), serverOffset = 0;
let replyTarget = null, selectedImage = null, previewUrl = null, lastSentAt = 0;
let firstLoad = true, messagesById = new Map();
let presenceData = {}, heartbeatTimer = 0, relativeTimer = 0;
let currentTheme = "og";
const messageNodes = new Map();

const THEMES = {
og: "Original Crimson",
lime: "Lime Green",
cobalt: "Cobalt Blue",
amber: "Amber Gold"
};

// Curated memorable word banks for deterministic, human-friendly usernames
const WORD_TRAITS = [
"silent", "lunar", "solar", "cryptic", "velvet", "static", "neon", "hollow",
"phantom", "cobalt", "crimson", "amber", "drift", "echo", "pixel", "cyber",
"frost", "shadow", "vivid", "muted", "lucid", "astral", "rogue", "zenith",
"binary", "prism", "ghost", "nova", "stray", "onyx", "mist", "hyper",
"ember", "alpine", "arctic", "cosmic", "golden", "iron", "jade", "marble",
"misty", "nordic", "obsidian", "orbital", "pastel", "polar", "quartz", "radiant",
"scarlet", "silver", "sonic", "stellar", "stormy", "sunken", "swift", "tundra",
"ultra", "vapor", "wild", "winter", "zero", "ambered", "breezy", "cinder"
];

const WORD_MATERIALS = [
"moss", "cedar", "maple", "birch", "stone", "flint", "spark", "cloud",
"rain", "river", "ocean", "canyon", "summit", "valley", "meadow", "forest",
"glacier", "desert", "island", "harbor", "beacon", "compass", "lantern", "anchor",
"mirror", "anvil", "forge", "blade", "shield", "crown", "chalice", "scroll",
"tablet", "prism", "lens", "circuit", "beacon", "signal", "pulse", "wave",
"spark", "ash", "smoke", "cinder", "frost", "snow", "hail", "thunder",
"breeze", "gale", "horizon", "eclipse", "comet", "meteor", "nebula", "starlight",
"dusk", "dawn", "midnight", "solstice", "equinox", "mirage", "oasis", "delta"
];

const WORD_CREATURES = [
"fox", "owl", "wolf", "lynx", "crow", "moth", "hawk", "viper",
"falcon", "raven", "heron", "kestrel", "badger", "otter", "martin", "stoat",
"hare", "stag", "ibex", "panther", "tiger", "jaguar", "cougar", "leopard",
"osprey", "condor", "eagle", "sparrow", "finch", "robin", "swallow", "swift",
"crane", "stork", "egret", "kingfisher", "puffin", "albatross", "petrel", "gull",
"mantis", "beetle", "hornet", "firefly", "dragonfly", "cicada", "monarch", "cobra",
"python", "gecko", "iguana", "tortoise", "newt", "salmon", "marlin", "orca",
"narwhal", "dolphin", "seal", "walrus", "kraken", "phoenix", "griffin", "wyvern"
];

// Primary 32-bit FNV-1a hash
function hashStringFNV1a(value) {
const str = String(value || "anonymous");
let hash = 2166136261;
for (let i = 0; i < str.length; i++) {
hash ^= str.charCodeAt(i);
hash = Math.imul(hash, 16777619);
}
return hash >>> 0;
}

// Secondary hash seed to expand entropy across 3 distinct word pools
function hashStringSecondary(value) {
const str = salt:${String(value || "anonymous")};
let hash = 0x811c9dc5;
for (let i = 0; i < str.length; i++) {
hash ^= str.charCodeAt(i);
hash = Math.imul(hash, 0x01000193);
}
return (hash ^ (hash >>> 16)) >>> 0;
}

// Deterministic hex color derived from UID
function getUserHexColor(senderId) {
const hash = hashStringFNV1a(senderId);
const hue = hash % 360;
const sat = 68 + ((hash >>> 9) % 18);
const light = 64 + ((hash >>> 17) % 14);

const s = sat / 100;
const l = light / 100;
const c = (1 - Math.abs(2 * l - 1)) * s;
const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
const m = l - c / 2;

let r1 = 0, g1 = 0, b1 = 0;
if (hue < 60) { r1 = c; g1 = x; b1 = 0; }
else if (hue < 120) { r1 = x; g1 = c; b1 = 0; }
else if (hue < 180) { r1 = 0; g1 = c; b1 = x; }
else if (hue < 240) { r1 = 0; g1 = x; b1 = c; }
else if (hue < 300) { r1 = x; g1 = 0; b1 = c; }
else { r1 = c; g1 = 0; b1 = x; }

const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, "0");
return #${toHex(r1)}${toHex(g1)}${toHex(b1)};
}

// Deterministic, pure-word memorable username synced with the user's hex color
function getUserHandle(senderId) {
const h1 = hashStringFNV1a(senderId);
const h2 = hashStringSecondary(senderId);
const hexInt = parseInt(getUserHexColor(senderId).slice(1), 16);

const trait = WORD_TRAITS[(h1 ^ (hexInt >>> 16)) % WORD_TRAITS.length];
const material = WORD_MATERIALS[(h2 ^ (hexInt >>> 8)) % WORD_MATERIALS.length];
const creature = WORD_CREATURES[((h1 >>> 12) ^ h2 ^ hexInt) % WORD_CREATURES.length];

return ${trait}-${material}-${creature};
}

function readCachedTheme() {
try {
const match = (window.name || "").match(/yappify_theme:([a-z]+)/);
return match && THEMES[match[1]] ? match[1] : null;
} catch {
return null;
}
}

function writeCachedTheme(theme) {
try {
const cleaned = (window.name || "").replace(/\s*yappify_theme:[a-z]+/g, "").trim();
window.name = ${cleaned} yappify_theme:${theme}.trim();
} catch {}
}

function applyTheme(theme, persist = false) {
currentTheme = THEMES[theme] ? theme : "og";
if (currentTheme === "og") {
document.documentElement.removeAttribute("data-theme");
} else {
document.documentElement.setAttribute("data-theme", currentTheme);
}
document.querySelectorAll(".theme-swatch").forEach(btn => {
btn.classList.toggle("active", btn.dataset.themeId === currentTheme);
});
writeCachedTheme(currentTheme);

if (persist && db && uid) {
set(ref(db, users/${uid}/prefs/theme), currentTheme).catch(err => {
console.warn("Theme save failed", err);
});
}
}

const initialCachedTheme = readCachedTheme();
if (initialCachedTheme) applyTheme(initialCachedTheme, false);

document.querySelectorAll(".theme-swatch").forEach(btn => {
btn.addEventListener("click", event => {
event.stopPropagation();
const nextTheme = btn.dataset.themeId;
if (nextTheme === currentTheme) return;
applyTheme(nextTheme, true);
toast(Theme: ${THEMES[nextTheme]});
});
});

ui.onlineToggle.addEventListener("click", event => {
event.stopPropagation();
const isOpen = ui.statusDock.classList.toggle("open");
ui.onlineToggle.setAttribute("aria-expanded", String(isOpen));
if (isOpen) updateDbStats();
});

document.addEventListener("click", event => {
if (!ui.statusDock.contains(event.target) && !ui.onlineToggle.contains(event.target)) {
ui.statusDock.classList.remove("open");
ui.onlineToggle.setAttribute("aria-expanded", "false");
}
});

function updateDbStats() {
const count = messagesById.size;
ui.statMsgs.textContent = ${count} / ${MAX_MESSAGES};

let totalBytes = 0;
for (const msg of messagesById.values()) {
totalBytes += JSON.stringify(msg).length;
}
ui.statSize.textContent = totalBytes > 1024
? ${(totalBytes / 1024).toFixed(1)} KB
: ${totalBytes} B;

ui.statOffset.textContent = ${serverOffset >= 0 ? "+" : ""}${Math.round(serverOffset)} ms;

if (uid) {
const hex = getUserHexColor(uid);
const handle = getUserHandle(uid);
ui.statUsername.textContent = handle;
ui.statUsername.title = ${handle} (${uid});
ui.statUsername.style.color = hex;
ui.statUserDot.style.background = hex;
ui.statUserDot.style.boxShadow = 0 0 6px ${hex};
ui.statHex.textContent = hex;
ui.statHex.style.color = hex;
ui.statUid.textContent = ${uid.slice(0, 6)}…${uid.slice(-4)};
ui.statUid.title = uid;
} else {
ui.statUsername.textContent = "connecting...";
ui.statUsername.style.color = "";
ui.statUserDot.style.background = "";
ui.statUserDot.style.boxShadow = "";
ui.statHex.textContent = "—";
ui.statHex.style.color = "";
ui.statUid.textContent = "connecting...";
ui.statUid.title = "Connecting";
}
}

function createSessionId() {
try {
let id = sessionStorage.getItem("yappify_session");
if (!id) {
id = crypto.randomUUID ? crypto.randomUUID() : ${Date.now().toString(36)}-${Math.random().toString(36).slice(2)};
sessionStorage.setItem("yappify_session", id);
}
return id;
} catch {
return ${Date.now().toString(36)}-${Math.random().toString(36).slice(2)};
}
}

function serverNow() { return Date.now() + serverOffset; }

function setStatus(status) {
ui.dot.style.background = status === "online" ? "#86efac" : status === "error" ? "#fb7185" : "#fcd34d";
ui.dot.title = status === "online" ? "Connected" : status === "error" ? "Connection error" : "Connecting";
}

function toast(message, error = false) {
const node = document.createElement("div");
node.className = toast${error ? " error" : ""};
node.textContent = message;
ui.toasts.append(node);
requestAnimationFrame(() => node.classList.add("show"));
setTimeout(() => {
node.classList.remove("show");
setTimeout(() => node.remove(), 180);
}, 2800);
}

function relativeTime(timestamp) {
const ts = Number(timestamp);
if (!Number.isFinite(ts) || ts <= 0) return "";
const seconds = Math.max(0, Math.floor((serverNow() - ts) / 1000));
if (seconds < 5) return "just now";
if (seconds < 60) return ${seconds}sec ago;
const minutes = Math.floor(seconds / 60);
if (minutes < 60) return ${minutes}min ago;
const hours = Math.floor(minutes / 60);
if (hours < 24) return ${hours}hr${hours === 1 ? "" : "s"} ago;
const days = Math.floor(hours / 24);
return ${days}day${days === 1 ? "" : "s"} ago;
}

function isNearBottom() {
return ui.messages.scrollHeight - ui.messages.scrollTop - ui.messages.clientHeight < 120;
}

function scrollBottom(smooth = false) {
ui.messages.scrollTo({ top: ui.messages.scrollHeight, behavior: smooth ? "smooth" : "auto" });
ui.latest.hidden = true;
}

function safeTextWithLinks(parent, value, mine) {
const text = String(value || "");
const urlPattern = /(https?://[^\s<]+)/g;
let cursor = 0;
for (const match of text.matchAll(urlPattern)) {
const start = match.index ?? 0;
if (start > cursor) parent.append(document.createTextNode(text.slice(cursor, start)));
const link = document.createElement("a");
link.href = match[0];
link.target = "_blank";
link.rel = "noopener noreferrer nofollow";
link.textContent = match[0];
link.style.cssText = mine
? "color:inherit;text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere;word-break:break-word"
: "color:var(--soft);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere;word-break:break-word";
link.addEventListener("click", event => event.stopPropagation());
parent.append(link);
cursor = start + match[0].length;
}
if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function copyText(value) {
if (navigator.clipboard?.writeText) {
navigator.clipboard.writeText(value).then(() => toast("Message copied")).catch(() => fallbackCopy(value));
} else fallbackCopy(value);
}

function fallbackCopy(value) {
const field = document.createElement("textarea");
field.value = value;
field.style.cssText = "position:fixed;left:-9999px;top:0";
document.body.append(field);
field.select();
let ok = false;
try { ok = document.execCommand("copy"); } catch {}
field.remove();
toast(ok ? "Message copied" : "Could not copy message", !ok);
}

function metaLine(parent, label, value, color = "") {
const line = document.createElement("div");
line.className = "meta-line";
const key = document.createElement("span");
key.className = "meta-key";
key.textContent = label;
const val = document.createElement("span");
val.className = "meta-value";
val.textContent = value || "—";
if (color) val.style.color = color;
line.append(key, val);
parent.append(line);
}

function getUserBubbleSurface(senderId, mine) {
const hash = hashStringFNV1a(senderId);
const hue = hash % 360;
const sat = mine ? 16 : 18;
const light = mine ? 16 : 15;
return hsl(${hue}, ${sat}%, ${light}%);
}

function jumpToMessage(id) {
const row = messageNodes.get(String(id));
if (!row) return toast("Original message is no longer loaded", true);
document.querySelectorAll(".message-jump-highlight").forEach(node => node.classList.remove("message-jump-highlight"));
void row.offsetWidth;
row.classList.add("message-jump-highlight");
row.scrollIntoView({ behavior: "smooth", block: "center" });
clearTimeout(row.jumpTimer);
row.jumpTimer = setTimeout(() => row.classList.remove("message-jump-highlight"), 2400);
}

function setReply(message) {
replyTarget = {
id: String(message.id),
sender: String(message.sender || ""),
text: String(message.text || "").slice(0, 180),
imageUrl: message.imageUrl || null
};
ui.replyText.textContent = replyTarget.text || (replyTarget.imageUrl ? "Image" : "Message");
ui.replyPreview.hidden = false;
ui.input.focus();
}

function clearReply() {
replyTarget = null;
ui.replyPreview.hidden = true;
ui.replyText.textContent = "";
}

function clearImage() {
selectedImage = null;
ui.file.value = "";
ui.imageWrap.hidden = true;
ui.imagePreview.removeAttribute("src");
ui.imageName.textContent = "";
if (previewUrl) URL.revokeObjectURL(previewUrl);
previewUrl = null;
}

function attachSwipe(row, bubble, message) {
let startX = 0, startY = 0, tracking = false, crossed = false;
bubble.addEventListener("pointerdown", event => {
if ((event.pointerType === "mouse" && event.button !== 0) || event.target.closest("button,a,img")) return;
tracking = true;
crossed = false;
startX = event.clientX;
startY = event.clientY;
});
bubble.addEventListener("pointermove", event => {
if (!tracking) return;
const dx = event.clientX - startX, dy = event.clientY - startY;
if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
tracking = false;
bubble.style.transform = "";
row.classList.remove("swiping");
return;
}
if (dx > 0) {
const distance = Math.min(dx, 92);
if (distance > 8) {
row.classList.add("swiping");
bubble.style.transform = translateX(${distance}px);
}
if (distance >= 64) crossed = true;
}
});
const finish = () => {
if (!tracking) return;
tracking = false;
bubble.style.transform = "";
row.classList.remove("swiping");
if (crossed) {
setReply(message);
row.dataset.skipClick = "1";
setTimeout(() => delete row.dataset.skipClick, 250);
}
};
bubble.addEventListener("pointerup", finish);
bubble.addEventListener("pointercancel", finish);
bubble.addEventListener("lostpointercapture", finish);
}

function renderMessage(message, previous) {
const mine = message.sender === uid;
const senderColor = getUserHexColor(message.sender);
const senderHandle = getUserHandle(message.sender);
const sameDayAsPrevious = previous && Number(message.ts) && Number(previous.ts) &&
getDateKey(message.ts) === getDateKey(previous.ts);
const grouped = sameDayAsPrevious && previous.sender === message.sender &&
Number(message.ts) - Number(previous.ts) < 90000;

const row = document.createElement("article");
row.className = message-row ${mine ? "mine" : "other"}${grouped ? " grouped" : ""};
row.id = message-${message.id};
const hint = document.createElement("span");
hint.className = "swipe-hint";
hint.textContent = "↪";
row.append(hint);

const bubble = document.createElement("div");
bubble.className = "message-bubble";
if (!mine) {
bubble.style.backgroundColor = getUserBubbleSurface(message.sender, false);
}
bubble.title = "Tap for details · Swipe right to reply";

if (message.replyTo && typeof message.replyTo === "object") {
const quote = document.createElement("button");
quote.type = "button";
quote.className = "reply-quote";
quote.title = "Jump to original message";
if (message.replyTo.sender === uid) {
const author = document.createElement("span");
author.className = "quote-author";
author.textContent = "You";
quote.append(author);
}
const quotedText = document.createElement("span");
quotedText.className = "quote-text";
quotedText.textContent = message.replyTo.text || (message.replyTo.imageUrl ? "Image" : "Message");
quote.append(quotedText);
quote.addEventListener("click", event => {
event.stopPropagation();
jumpToMessage(message.replyTo.id);
});
bubble.append(quote);
}

if (message.text) {
const text = document.createElement("div");
text.style.overflowWrap = "anywhere";
text.style.wordBreak = "break-word";
safeTextWithLinks(text, message.text, mine);
bubble.append(text);
}

if (typeof message.imageUrl === "string" && /^https:///i.test(message.imageUrl)) {
const image = document.createElement("img");
image.className = "message-image";
image.src = message.imageUrl;
image.alt = "Shared image";
image.loading = "lazy";
image.referrerPolicy = "no-referrer";
image.addEventListener("click", event => {
event.stopPropagation();
window.open(message.imageUrl, "_blank", "noopener,noreferrer");
});
bubble.append(image);
}

const basic = document.createElement("div");
basic.className = "basic-meta";
if (mine) {
const you = document.createElement("span");
you.textContent = "You";
basic.append(you);
}
const time = document.createElement("span");
time.dataset.timestamp = message.ts || "";
time.textContent = message.ts ? relativeTime(message.ts) : "";
basic.append(time);
bubble.append(basic);

const details = document.createElement("div");
details.className = "message-details";

const detailsInner = document.createElement("div");
detailsInner.className = "message-details-inner";

metaLine(detailsInner, "Message ID", message.id);
metaLine(detailsInner, "Username", mine ? ${senderHandle} (You) : senderHandle, senderColor);
metaLine(detailsInner, "Sender ID", message.sender);
metaLine(detailsInner, "User Hex", senderColor, senderColor);
metaLine(detailsInner, "Local time", message.ts ? new Date(message.ts).toLocaleString() : "Unavailable");
metaLine(detailsInner, "UTC time", message.ts ? new Date(message.ts).toISOString() : "Unavailable");
metaLine(detailsInner, "Unix time", message.ts ? String(message.ts) : "Unavailable");
metaLine(detailsInner, "Payload", ${(message.text || "").length} text chars${message.imageUrl ? " · image attached" : ""}${message.replyTo ? " · reply" : ""});

const actions = document.createElement("div");
actions.className = "actions";
if (message.text) {
const copy = document.createElement("button");
copy.type = "button";
copy.textContent = "Copy";
copy.addEventListener("click", event => {
event.stopPropagation();
copyText(message.text);
});
actions.append(copy);
}
const reply = document.createElement("button");
reply.type = "button";
reply.textContent = "↩ Reply";
reply.addEventListener("click", event => {
event.stopPropagation();
setReply(message);
});
actions.append(reply);
detailsInner.append(actions);
details.append(detailsInner);
bubble.append(details);

bubble.addEventListener("click", event => {
if (row.dataset.skipClick === "1") {
delete row.dataset.skipClick;
return;
}
if (event.target.closest("a,button,img")) return;
row.classList.toggle("expanded");
});
attachSwipe(row, bubble, message);
row.append(bubble);
messageNodes.set(String(message.id), row);
return row;
}

function getDateKey(timestamp) {
const d = new Date(Number(timestamp));
return ${d.getFullYear()}-${d.getMonth()}-${d.getDate()};
}

function formatDateBadge(timestamp) {
const d = new Date(Number(timestamp));
const dd = String(d.getDate()).padStart(2, "0");
const mm = String(d.getMonth() + 1).padStart(2, "0");
const yyyy = d.getFullYear();
return ${dd}.${mm}.${yyyy};
}

function createDateDivider(timestamp) {
const divider = document.createElement("div");
divider.className = "date-divider";
const label = document.createElement("span");
label.textContent = formatDateBadge(timestamp);
divider.append(label);
return divider;
}

function drawMessages() {
const wasAtBottom = firstLoad || isNearBottom();
const ordered = [...messagesById.values()].sort((a,b) => (Number(a.ts)||0) - (Number(b.ts)||0));
const fragment = document.createDocumentFragment();
messageNodes.clear();
if (!ordered.length) {
const empty = document.createElement("div");
empty.className = "empty";
empty.textContent = "No messages yet.";
fragment.append(empty);
} else {
let lastDateKey = "";
ordered.forEach((message, index) => {
const ts = Number(message.ts);
if (Number.isFinite(ts) && ts > 0) {
const dateKey = getDateKey(ts);
if (dateKey !== lastDateKey) {
fragment.append(createDateDivider(ts));
lastDateKey = dateKey;
}
}
fragment.append(renderMessage(message, ordered[index - 1]));
});
}
ui.messages.replaceChildren(fragment);
if (wasAtBottom) scrollBottom();
else ui.latest.hidden = false;
firstLoad = false;
updateDbStats();
}

function updateRelativeTimes() {
document.querySelectorAll("[data-timestamp]").forEach(node => {
const ts = Number(node.dataset.timestamp);
if (ts) node.textContent = relativeTime(ts);
});
}

function setOnlineCount() {
const now = serverNow();
let count = 0;
for (const userSessions of Object.values(presenceData)) {
if (!userSessions || typeof userSessions !== "object") continue;
for (const record of Object.values(userSessions)) {
const ts = Number(record?.ts);
if (Number.isFinite(ts) && now - ts >= -5000 && now - ts <= STALE_MS) count++;
}
}
const strCount = String(count);
ui.count.textContent = strCount;
ui.dockOnlineCount.textContent = strCount;
}

let presenceRef, ownPresenceRef;
async function startPresence() {
presenceRef = ref(db, presence/${ROOM});
ownPresenceRef = ref(db, presence/${ROOM}/${uid}/${sessionId});
const connectedRef = ref(db, ".info/connected");
const offsetRef = ref(db, ".info/serverTimeOffset");

onValue(offsetRef, snap => {
const value = snap.val();
if (Number.isFinite(value)) {
serverOffset = value;
setOnlineCount();
updateRelativeTimes();
updateDbStats();
}
});

onValue(presenceRef, snap => {
presenceData = snap.val() || {};
setOnlineCount();
}, error => {
console.error("Presence read failed", error);
toast(Presence error: ${error.code || error.message}, true);
});

const heartbeat = async () => {
if (document.visibilityState !== "visible") return;
try {
await set(ownPresenceRef, { uid, session: sessionId, ts: serverTimestamp() });
} catch (error) {
console.warn("Heartbeat failed", error);
}
};

onValue(connectedRef, async snap => {
if (snap.val() !== true) {
setStatus("connecting");
return;
}
setStatus("online");
try {
await onDisconnect(ownPresenceRef).remove();
await heartbeat();
} catch (error) {
console.error("Presence setup failed", error);
}
});

heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
document.addEventListener("visibilitychange", () => {
if (document.visibilityState === "visible") heartbeat();
else remove(ownPresenceRef).catch(() => {});
});
window.addEventListener("pagehide", () => {
clearInterval(heartbeatTimer);
remove(ownPresenceRef).catch(() => {});
}, { once: true });
}

function subscribeMessages() {
const roomQuery = query(ref(db, rooms/${ROOM}), limitToLast(MAX_MESSAGES));
onValue(roomQuery, snapshot => {
const next = new Map();
snapshot.forEach(child => {
const data = child.val();
if (!data || typeof data !== "object") return;
if (data.ghost === true || (typeof data.id === "string" && data.id.startsWith("ghost_"))) return;
const text = typeof data.text === "string" ? data.text.replace(/\u200b/g, "").trim() : "";
const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : "";
if (!text && !imageUrl) return;
next.set(child.key, { ...data, id: child.key, text });
});
messagesById = next;
drawMessages();
setStatus("online");
}, error => {
console.error("Message listener failed", error);
setStatus("error");
toast(Firebase read error: ${error.code || error.message}, true);
});
}

async function uploadImage(file) {
if (!allowedImages.has(file.type) || file.size > MAX_IMAGE_BYTES) {
throw new Error("Use JPG, PNG, WEBP, or GIF up to 5 MB.");
}
const body = new FormData();
body.append("image", file);
body.append("name", file.name.replace(/[^a-zA-Z0-9.-]/g, "").slice(-80));
toast("Uploading image...");
const response = await fetch(https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMAGE_HOST_KEY)}, {
method: "POST", body
});
const result = await response.json().catch(() => null);
if (!response.ok || !result?.success || !result?.data?.url) {
throw new Error(result?.error?.message || Image upload failed (${response.status}));
}
return result.data.url;
}

let profanity = null;
async function loadProfanityFilter() {
try {
const module = await import("https://esm.sh/leo-profanity@1.9.0");
profanity = module.default || module;
} catch (error) {
console.warn("Filter unavailable", error);
toast("Word filter unavailable.", true);
}
}

ui.attach.addEventListener("click", () => ui.file.click());
ui.cancelReply.addEventListener("click", clearReply);
ui.removeImage.addEventListener("click", clearImage);
ui.latest.addEventListener("click", () => scrollBottom(true));
ui.messages.addEventListener("scroll", () => {
if (isNearBottom()) ui.latest.hidden = true;
});

ui.file.addEventListener("change", () => {
const file = ui.file.files?.[0];
if (!file) return;
if (!allowedImages.has(file.type)) {
toast("Choose a JPG, PNG, WEBP, or GIF image.", true);
return clearImage();
}
if (file.size > MAX_IMAGE_BYTES) {
toast("Image must be 5 MB or smaller.", true);
return clearImage();
}
selectedImage = file;
if (previewUrl) URL.revokeObjectURL(previewUrl);
previewUrl = URL.createObjectURL(file);
ui.imagePreview.src = previewUrl;
ui.imageName.textContent = file.name;
ui.imageWrap.hidden = false;
});

ui.input.addEventListener("input", () => {
ui.input.style.height = "auto";
ui.input.style.height = ${Math.min(ui.input.scrollHeight, 160)}px;
});
ui.input.addEventListener("keydown", event => {
if (event.key === "Enter" && !event.shiftKey) {
event.preventDefault();
ui.form.requestSubmit();
}
});

ui.form.addEventListener("submit", async event => {
event.preventDefault();
const raw = ui.input.value.trim();
const file = selectedImage;
if (!raw && !file) return;
if (!db || !uid) return toast("Connecting to database...", true);
if (raw && !profanity) return toast("Filter loading...", true);
const now = Date.now();
if (now - lastSentAt < SEND_COOLDOWN_MS) {
return toast(Wait ${((SEND_COOLDOWN_MS - (now - lastSentAt)) / 1000).toFixed(1)}s, true);
}

ui.send.disabled = true;
ui.attach.disabled = true;
try {
const cleaned = raw && profanity ? profanity.clean(raw, "*") : "";
const imageUrl = file ? await uploadImage(file) : null;
const payload = {
sender: uid,
text: cleaned.slice(0, 500),
ts: serverTimestamp()
};
if (imageUrl) payload.imageUrl = imageUrl;
if (replyTarget) payload.replyTo = { ...replyTarget };
await push(ref(db, rooms/${ROOM}), payload);
if (cleaned !== raw) toast("Some words were replaced with *.");
lastSentAt = Date.now();
ui.input.value = "";
ui.input.style.height = "auto";
clearImage();
clearReply();
} catch (error) {
console.error("Send failed", error);
toast(${error.code ? error.code + ": " : ""}${error.message || "Failed to send."}, true);
} finally {
ui.send.disabled = false;
ui.attach.disabled = false;
ui.input.focus();
}
});

async function boot() {
setStatus("connecting");
try {
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
db = getDatabase(app, firebaseConfig.databaseURL);

const authTimeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("Sign-in timed out.")), 15000)
);
const credential = await Promise.race([signInAnonymously(auth), authTimeout]);
uid = credential.user.uid;
updateDbStats();

onValue(ref(db, `users/${uid}/prefs/theme`), snap => {
  const saved = snap.val();
  if (typeof saved === "string" && THEMES[saved] && saved !== currentTheme) {
    applyTheme(saved, false);
  } else if (!saved && currentTheme !== "og") {
    set(ref(db, `users/${uid}/prefs/theme`), currentTheme).catch(() => {});
  }
}, () => {});

subscribeMessages();
await startPresence();
setStatus("online");


} catch (error) {
console.error("Startup failed", error);
setStatus("error");
toast(Firebase error: ${error.code || error.message || "Connection failed"}, true);
}
}

window.addEventListener("error", event => {
console.error("Runtime error:", event.error || event.message);
setStatus("error");
toast(App error: ${event.message || "Unknown error"}, true);
});
window.addEventListener("unhandledrejection", event => {
const reason = event.reason;
console.error("Unhandled rejection:", reason);
setStatus("error");
toast(App error: ${reason?.code || reason?.message || "Async error"}, true);
});

ui.messages.innerHTML = '...';
relativeTimer = setInterval(updateRelativeTimes, 1000);
loadProfanityFilter();
boot();
setInterval(setOnlineCount, 5000);
