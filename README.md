# SUPREME KAI MD

A lightweight WhatsApp bot starter built with Baileys, with a localhost-only session generator.

## Features

- QR login or session restoration using a base64 ZIP session payload
- Local website to generate a session payload for your own WhatsApp account
- Owner-number checking via `config.js`
- Configurable-prefix commands: `.help`, `.ping`, `.status`, `.owner`, `.echo`, and `.session`

## Run the bot

```bash
npm install
npm start
```

## Generate a session ID

Run the generator on your own computer (Node.js 20+):

```bash
npm install
npm run session-site
```

Open `http://127.0.0.1:3001` **on that same computer**, click **Start pairing**, and scan the QR code with WhatsApp → Linked devices. Copy or download the resulting `SESSION_ID`, then set it as a secret environment variable on the machine hosting the bot.

The generator binds to `127.0.0.1` and is intentionally not exposed to the internet. Do not deploy it as a public website or share the generated ID: it contains WhatsApp authentication credentials. To generate another session after a logout, remove the local `session-generator-auth/` directory and restart the generator.

The bot's owner-only `.session` command provides these instructions. The URL in `config.js` should remain a localhost URL.

## Configuration

Edit `config.js` before running the bot:

- `botName`
- `ownerName`
- `ownerNumbers`
- `channelLink`
- `mode`
- `prefix`

## Session restore

The bot supports `SESSION_ID` in this format:

```text
SUPREME-KAI-<base64-encoded-zip>
```

The ZIP contains the Baileys auth files, including `creds.json`. Treat the value as a password: anyone who obtains it may access the linked WhatsApp account. Configure it only through your host's secret environment-variable settings.
