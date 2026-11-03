const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");
const unzipper = require("unzipper");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const config = require("./config");

const SESSION_DIR = path.join(__dirname, "session");
const SESSION_PREFIX = "SUPREME-KAI-";

function isOwner(jid) {
  const number = jid?.split("@")[0].split(":")[0];
  return config.ownerNumbers.includes(number);
}

async function restoreSession() {
  const sessionId = process.env.SESSION_ID;

  if (!sessionId) {
    console.log("No SESSION_ID found. QR login will be used.");
    return;
  }

  const credsPath = path.join(SESSION_DIR, "creds.json");

  if (fs.existsSync(credsPath)) {
    console.log("Existing WhatsApp session found.");
    return;
  }

  if (!sessionId.startsWith(SESSION_PREFIX)) {
    throw new Error("Invalid SESSION_ID format.");
  }

  const encoded = sessionId.slice(SESSION_PREFIX.length);
  const zipBuffer = Buffer.from(encoded, "base64");

  if (!zipBuffer.length) {
    throw new Error("SESSION_ID is empty or invalid.");
  }

  console.log("Restoring WhatsApp session...");

  await fs.promises.mkdir(SESSION_DIR, { recursive: true });

  const archive = await unzipper.Open.buffer(zipBuffer);

  for (const entry of archive.files) {
    const destination = path.resolve(SESSION_DIR, entry.path);

    if (
      destination !== SESSION_DIR &&
      !destination.startsWith(SESSION_DIR + path.sep)
    ) {
      throw new Error("Unsafe session archive entry.");
    }

    if (entry.type === "Directory") {
      await fs.promises.mkdir(destination, { recursive: true });
      continue;
    }

    await fs.promises.mkdir(path.dirname(destination), {
      recursive: true
    });

    await pipeline(
      entry.stream(),
      fs.createWriteStream(destination)
    );
  }

  if (!fs.existsSync(credsPath)) {
    throw new Error("Session archive does not contain creds.json.");
  }

  console.log("WhatsApp session restored successfully.");
}

async function startBot() {
  await restoreSession();

  const { state, saveCreds } =
    await useMultiFileAuthState(SESSION_DIR);

  const socket = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: [config.botName, "Chrome", config.version]
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scan QR using WhatsApp > Linked devices:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      console.log(`${config.botName} is connecting...`);
    }

    if (connection === "open") {
      console.log("================================");
      console.log(`WELCOME TO ${config.botName}`);
      console.log("WhatsApp connection successful!");
      console.log("Bot mode:", config.mode);
      console.log("Prefix:", config.prefix);
      console.log("Channel:", config.channelLink);
      console.log("================================");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Logged out. A new session is required.");
        return;
      }

      console.log("Connection closed. Reconnecting...");
      setTimeout(() => {
        startBot().catch(console.error);
      }, 5000);
    }
  });

  socket.ev.on("messages.upsert", ({ messages }) => {
    for (const message of messages) {
      if (!message.key.fromMe && message.message) {
        const sender = message.key.remoteJid;
        const owner = isOwner(sender);

        console.log("New message received");
        console.log("Sender:", sender);
        console.log("Owner:", owner ? "YES" : "NO");
      }
    }
  });
}

startBot().catch((error) => {
  console.error("Bot startup failed:", error);
});
