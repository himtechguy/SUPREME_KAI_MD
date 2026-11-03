const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const archiver = require("archiver");
const QRCode = require("qrcode");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const HOST = "127.0.0.1";
const PORT = Number(process.env.SESSION_SITE_PORT || 3001);
const AUTH_DIR = path.join(__dirname, "..", "session-generator-auth");
const SESSION_PREFIX = "SUPREME-KAI-";
const PUBLIC_DIR = path.join(__dirname, "public");
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

let socket;
let status = { state: "idle", qr: null, sessionId: null, error: null };

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  response.end(JSON.stringify(data));
}

function isLocalRequest(request) {
  if (!ALLOWED_HOSTS.has(request.headers.host)) return false;
  const origin = request.headers.origin;
  return !origin || origin === `http://${request.headers.host}`;
}

function createSessionId() {
  return new Promise((resolve, reject) => {
    const output = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    output.on("data", (chunk) => chunks.push(chunk));
    output.on("error", reject);
    output.on("end", () => resolve(SESSION_PREFIX + Buffer.concat(chunks).toString("base64")));
    output.directory(AUTH_DIR, false);
    output.finalize();
  });
}

async function startSession() {
  if (status.state === "starting" || status.state === "waiting" || status.state === "connected") {
    return;
  }

  status = { state: "starting", qr: null, sessionId: null, error: null };
  try {
    await fs.promises.mkdir(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    socket = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["SUPREME KAI MD Session Generator", "Chrome", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          status = { ...status, state: "waiting", qr: await QRCode.toDataURL(qr), error: null };
        } catch (error) {
          status = { ...status, state: "error", error: "Could not render the QR code." };
        }
      }
      if (connection === "open") {
        try {
          const sessionId = await createSessionId();
          status = { state: "connected", qr: null, sessionId, error: null };
        } catch (error) {
          console.error("Could not package session:", error);
          status = { state: "error", qr: null, sessionId: null, error: "Connected, but session packaging failed. Check the local server logs." };
        }
      }
      if (connection === "close" && status.state !== "idle") {
        const code = lastDisconnect?.error?.output?.statusCode;
        status = {
          state: "error",
          qr: null,
          sessionId: null,
          error: code === DisconnectReason.loggedOut
            ? "WhatsApp logged out. Reset the local generator auth folder and try again."
            : "Connection closed. Restart the generator and try again."
        };
      }
    });
  } catch (error) {
    console.error("Session generator startup failed:", error);
    status = { state: "error", qr: null, sessionId: null, error: "Could not start the WhatsApp session. Check the local server logs." };
  }
}

async function stopSession() {
  const previousSocket = socket;
  socket = null;
  status = { state: "idle", qr: null, sessionId: null, error: null };
  if (previousSocket) {
    try {
      previousSocket.end(undefined);
    } catch (error) {
      console.error("Error stopping session socket:", error);
    }
  }
}

const server = http.createServer(async (request, response) => {
  if (!isLocalRequest(request)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Local access only");
    return;
  }

  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (request.method === "GET" && pathname === "/api/status") {
    sendJson(response, 200, status);
    return;
  }
  if (request.method === "POST" && pathname === "/api/start") {
    await startSession();
    sendJson(response, 200, { state: status.state });
    return;
  }
  if (request.method === "POST" && pathname === "/api/stop") {
    await stopSession();
    sendJson(response, 200, { state: status.state });
    return;
  }
  if (request.method === "GET" && pathname === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    });
    fs.createReadStream(path.join(PUBLIC_DIR, "index.html")).pipe(response);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Local session generator: http://${HOST}:${PORT}`);
  console.log("This service is bound to localhost and is not publicly accessible.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await stopSession();
    server.close(() => process.exit(0));
  });
}
