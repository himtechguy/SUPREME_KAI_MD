# SUPREME KAI MD

A lightweight WhatsApp bot starter built with Baileys.

## Features

- QR login or session restoration using a base64 ZIP session payload
- Owner-number checking via `config.js`
- Command handling with a configurable prefix
- Basic commands:
  - `.help` / `.menu`
  - `.ping`
  - `.status`
  - `.owner`
  - `.echo`

## Run locally

```bash
npm install
npm start
```

## Configuration

Edit `config.js` before running the bot:

- `botName`
- `ownerName`
- `ownerNumbers`
- `channelLink`
- `mode`
- `prefix`

## Session restore

The service supports `SESSION_ID` in this format:

```text
SUPREME-KAI-<base64-encoded-zip>
```

This ZIP should contain a valid WhatsApp auth folder including `creds.json`.

