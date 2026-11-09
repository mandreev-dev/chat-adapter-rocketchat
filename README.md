# chat-adapter-rocketchat

Rocket.Chat adapter for [Vercel Chat SDK](https://chat-sdk.dev/).

## Install

```bash
pnpm add chat-adapter-rocketchat chat
```

Requires Chat SDK ^4.44.0 and Node.js >= 20.

## Quick start

Install a state adapter for subscriptions and locking. This example uses in-memory state:

```bash
pnpm add @chat-adapter/state-memory
```

```ts
import { Chat } from "chat";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRocketChatAdapter } from "chat-adapter-rocketchat";

const adapter = createRocketChatAdapter({
	baseUrl: process.env.ROCKETCHAT_URL!,
	token: process.env.ROCKETCHAT_TOKEN!,
	botUserId: process.env.ROCKETCHAT_USER_ID!,
	webhookToken: process.env.ROCKETCHAT_WEBHOOK_TOKEN!,
});

const bot = new Chat({
	userName: "my-bot",
	state: createMemoryState(),
	adapters: {
		rocketchat: adapter,
	},
});

bot.onNewMention(async (thread) => {
	await thread.post("Hello from Rocket.Chat via Chat SDK.");
});

await bot.initialize();
```

Route incoming Outgoing Webhook requests to the adapter in your server:

```ts
app.post("/api/webhooks/rocketchat", async (req) => {
	return bot.webhooks.rocketchat(req);
});
```

In-memory state is for local development or a single ephemeral process. Use a persistent, shared state adapter (such as Redis or PostgreSQL) in production.

Configuration can also be provided through environment variables:

```bash
export ROCKETCHAT_URL=https://chat.example.com
export ROCKETCHAT_TOKEN=your-personal-access-token
export ROCKETCHAT_USER_ID=your-bot-user-id
export ROCKETCHAT_WEBHOOK_TOKEN=your-outgoing-webhook-token
export ROCKETCHAT_BOT_USERNAME=my-bot
```

```ts
const adapter = createRocketChatAdapter();
```

## Rocket.Chat setup

1. **Create a bot user** -- In the Rocket.Chat admin, go to **Users** and create a new user with the `bot` role. Generate a **personal access token** for it under **My Account > Personal Access Tokens**; this is `ROCKETCHAT_TOKEN`. Copy the user's ID (visible in the admin user list or via `users.info`); this is `ROCKETCHAT_USER_ID`.

2. **Add the bot to rooms** -- Add the bot user to any channel, private group, or DM where it should respond. The REST API calls the bot makes (posting, editing, reacting) require it to be a member of the room.

3. **Create an Outgoing Webhook integration** -- In the admin, go to **Integrations > New > Outgoing Webhook**. Set the trigger to messages sent, the target URL to your bot's `/api/webhooks/rocketchat` endpoint, and a random token of your choosing; this is `ROCKETCHAT_WEBHOOK_TOKEN`. Rocket.Chat posts every matching message to that URL with the token in the payload, and the adapter rejects requests whose token doesn't match.

4. **Scope the webhook to rooms** -- An Outgoing Webhook can be scoped to specific channels or fire on every room the bot is a member of, depending on how the integration is configured. Configure it to match where you want the bot to listen.

This adapter uses the REST API for every outbound call and an Outgoing Webhook for inbound messages. It does not open a realtime WebSocket/DDP connection, so no long-running connection needs to be kept alive beyond your HTTP server.

## Thread IDs

```
rocketchat:{roomId}
rocketchat:{roomId}:{tmid}
```

- `roomId` is the Rocket.Chat room ID (channel, private group, or DM), as sent in the webhook payload's `channel_id` and returned by `rooms.info`.
- The room-level thread ID (`rocketchat:{roomId}`) is used for a plain message posted directly in a room.
- The thread-reply ID (`rocketchat:{roomId}:{tmid}`) is used when a message is a reply inside a Rocket.Chat thread (`tmid` is the parent message ID).
- The channel ID is always `rocketchat:{roomId}`, with no thread suffix.
- `encodeThreadId` / `decodeThreadId` are the only sanctioned constructors.

## Limitations

- **No cards, buttons, or modals** -- interactive payloads are not implemented in this version. Posting a card falls back to its plain-text rendering.
- **No slash commands** -- the adapter only handles plain message events from the Outgoing Webhook integration.
- **No streaming** -- messages are posted in full; there is no post-then-edit or token-by-token streaming support yet.
- **No typing indicator** -- Rocket.Chat's REST API has no endpoint to send a typing event, so `startTyping()` is a documented no-op.
- **Markdown tables render as an ASCII code block** -- Rocket.Chat's markdown dialect has no native table syntax, so `| a | b |` tables are converted into a fixed-width table inside a code fence.
- **REST-only transport** -- no realtime DDP/WebSocket subscription; inbound messages depend entirely on the Outgoing Webhook integration reaching your bot's HTTP endpoint.

## Feature Support

| Feature              | Status | Notes                                                                                       |
| -------------------- | :----: | --------------------------------------------------------------------------------------------- |
| Message posting      |   ✅   | Post, edit, and delete messages in rooms and threads via the REST API.                        |
| Direct messages      |   ✅   | DM rooms are addressed the same way as channels; `isDM` is reported from `rooms.info`.         |
| Emoji / Reactions    |   ✅   | Outgoing emoji formatting plus add/remove reaction handling via `chat.react`.                 |
| Message history      |   ✅   | `fetchMessages`/`fetchMessage` via `rooms.history` and `chat.getThreadMessages`.               |
| Typing indicators    |   ❌   | No REST endpoint exists for typing events; `startTyping()` is a documented no-op.             |
| Cards                |   ❌   | Not implemented. Card payloads fall back to plain text.                                        |
| Streaming            |   ❌   | Not implemented. Messages are posted once, in full.                                            |
| Slash commands       |   ❌   | Not implemented.                                                                                |
| Modals               |   ❌   | Not implemented.                                                                                |

## Notes

- The adapter connects to Rocket.Chat over the REST API v1 (`X-Auth-Token` / `X-User-Id` headers) and receives inbound messages through an Outgoing Webhook integration, not a realtime connection.
- Rocket.Chat markdown differs slightly from CommonMark: bold is `*text*` (single asterisk), italic is `_text_`, and strikethrough is `~text~` (single tilde). The adapter's `RocketChatFormatConverter` handles the conversion in both directions.
- Bot self-detection compares the configured `botUserId` against each incoming message's author ID; there is no username-based fallback.
- This is a community adapter. The `@chat-adapter/*` npm scope is reserved for official adapters; this package is published as `chat-adapter-rocketchat`.

## License

[MIT](LICENSE) © mandreev-dev
