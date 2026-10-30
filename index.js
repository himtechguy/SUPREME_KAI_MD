
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const socket = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["SUPREME KAI MD", "Chrome", "1.0.0"]
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scan this QR code using WhatsApp > Linked devices:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      console.log("SUPREME KAI MD is connecting...");
    }

    if (connection === "open") {
      console.log("SUPREME KAI MD is connected!");
      console.log("Test mode: online. No commands enabled.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Session logged out. A new QR scan is required.");
        return;
      }

      console.log("Connection closed. Reconnecting...");
      setTimeout(startBot, 5000);
    }
  });

  socket.ev.on("messages.upsert", ({ messages }) => {
    for (const message of messages) {
      if (!message.key.fromMe && message.message) {
        console.log("Message received from:", message.key.remoteJid);
      }
    }
  });
}

startBot().catch(console.error);
