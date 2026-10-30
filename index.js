
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");
const config = require("./config");

function isOwner(jid) {
  const number = jid?.split("@")[0].split(":")[0];

  return config.ownerNumbers.includes(number);
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./session");

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
        console.log("Logged out. A new QR scan is required.");
        return;
      }

      console.log("Connection closed. Reconnecting...");
      setTimeout(startBot, 5000);
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
