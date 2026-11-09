import {
	AdapterRateLimitError,
	AuthenticationError,
	NetworkError,
	PermissionError,
	ResourceNotFoundError,
	ValidationError,
} from "@chat-adapter/shared";
import {
	createMockChatInstance,
	createMockLogger,
	selfMessageContract,
	threadIdContract,
} from "@chat-adapter/tests";
import type { ChatInstance } from "chat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createRocketChatAdapter,
	RocketChatAdapter,
	type RocketChatAdapterConfig,
	type RocketChatMessage,
} from "./index";

const BASE_URL = "https://chat.example.com";
const TOKEN = "test-auth-token";
const BOT_USER_ID = "bot-user-id";
const WEBHOOK_TOKEN = "test-webhook-token";
const ROOM_ID = "GENERAL";

const ENV_KEYS = [
	"ROCKETCHAT_URL",
	"ROCKETCHAT_TOKEN",
	"ROCKETCHAT_USER_ID",
	"ROCKETCHAT_WEBHOOK_TOKEN",
	"ROCKETCHAT_BOT_USERNAME",
] as const;

interface MockRoute {
	body?: unknown;
	headers?: Record<string, string>;
	method?: string;
	path: string | RegExp;
	status?: number;
}

interface RecordedCall {
	body: unknown;
	headers: Headers;
	method: string;
	url: URL;
}

let calls: RecordedCall[] = [];

function mockFetch(routes: MockRoute[]): void {
	calls = [];
	vi.stubGlobal(
		"fetch",
		vi.fn((input: URL | string, init?: RequestInit) => {
			const url = new URL(input.toString());
			const method = init?.method ?? "GET";
			let body: unknown = init?.body;
			if (typeof body === "string") {
				body = JSON.parse(body);
			}
			calls.push({ url, method, body, headers: new Headers(init?.headers) });
			const path = url.pathname.replace("/api/v1", "");
			const route = routes.find(
				(r) =>
					(r.method ?? "GET") === method &&
					(typeof r.path === "string" ? r.path === path : r.path.test(path)),
			);
			if (!route) {
				return Promise.resolve(
					new Response(`no route for ${method} ${path}`, { status: 500 }),
				);
			}
			const status = route.status ?? 200;
			return Promise.resolve(
				new Response(status === 204 ? null : JSON.stringify(route.body ?? {}), {
					status,
					headers: { "content-type": "application/json", ...route.headers },
				}),
			);
		}),
	);
}

function createAdapter(overrides: Partial<RocketChatAdapterConfig> = {}): RocketChatAdapter {
	return createRocketChatAdapter({
		baseUrl: BASE_URL,
		token: TOKEN,
		botUserId: BOT_USER_ID,
		webhookToken: WEBHOOK_TOKEN,
		userName: "my-bot",
		logger: createMockLogger(),
		...overrides,
	});
}

async function setup(
	overrides: Partial<RocketChatAdapterConfig> = {},
): Promise<{ adapter: RocketChatAdapter; chat: ChatInstance }> {
	const adapter = createAdapter(overrides);
	const chat = createMockChatInstance();
	await adapter.initialize(chat);
	return { adapter, chat };
}

function restMessage(overrides: Partial<RocketChatMessage> = {}): RocketChatMessage {
	return {
		_id: "msg1",
		msg: "Hello there",
		rid: ROOM_ID,
		ts: "2026-10-01T10:00:00.000Z",
		u: { _id: "U1", username: "ada", name: "Ada Lovelace" },
		...overrides,
	};
}

function webhookBody(overrides: Record<string, unknown> = {}) {
	return {
		token: WEBHOOK_TOKEN,
		bot: false,
		channel_id: ROOM_ID,
		channel_name: "general",
		message_id: "msg1",
		timestamp: "1700000000000",
		user_id: "U1",
		user_name: "ada",
		text: "Hello there",
		...overrides,
	};
}

function webhookRequest(body: unknown = webhookBody()): Request {
	return new Request("https://bot.example.com/api/webhooks/rocketchat", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	for (const key of ENV_KEYS) {
		vi.stubEnv(key, undefined);
	}
	mockFetch([]);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

threadIdContract({
	name: "rocketchat",
	encode: (d) => createAdapter().encodeThreadId(d),
	decode: (id) => createAdapter().decodeThreadId(id),
	cases: [
		{ decoded: { roomId: ROOM_ID }, encoded: `rocketchat:${ROOM_ID}` },
		{
			decoded: { roomId: ROOM_ID, tmid: "thread1" },
			encoded: `rocketchat:${ROOM_ID}:thread1`,
		},
	],
});

selfMessageContract({
	name: "rocketchat",
	setup: () => setup(),
	makeOtherMessageRequest: () => webhookRequest(),
	makeSelfMessageRequest: () =>
		webhookRequest(webhookBody({ user_id: BOT_USER_ID, user_name: "my-bot" })),
});

describe("constructor", () => {
	it("reads configuration from environment variables", () => {
		vi.stubEnv("ROCKETCHAT_URL", BASE_URL);
		vi.stubEnv("ROCKETCHAT_TOKEN", TOKEN);
		vi.stubEnv("ROCKETCHAT_USER_ID", BOT_USER_ID);
		vi.stubEnv("ROCKETCHAT_WEBHOOK_TOKEN", WEBHOOK_TOKEN);
		vi.stubEnv("ROCKETCHAT_BOT_USERNAME", "env-bot");
		const adapter = createRocketChatAdapter({ logger: createMockLogger() });
		expect(adapter.name).toBe("rocketchat");
		expect(adapter.userName).toBe("env-bot");
		expect(adapter.botUserId).toBe(BOT_USER_ID);
	});

	it("requires a base URL", () => {
		expect(
			() =>
				new RocketChatAdapter({
					token: TOKEN,
					botUserId: BOT_USER_ID,
					webhookToken: WEBHOOK_TOKEN,
				}),
		).toThrow(/Server URL is required/);
	});

	it("requires a token", () => {
		expect(
			() =>
				new RocketChatAdapter({
					baseUrl: BASE_URL,
					botUserId: BOT_USER_ID,
					webhookToken: WEBHOOK_TOKEN,
				}),
		).toThrow(/Authentication is required/);
	});

	it("requires a bot user ID", () => {
		expect(
			() =>
				new RocketChatAdapter({
					baseUrl: BASE_URL,
					token: TOKEN,
					webhookToken: WEBHOOK_TOKEN,
				}),
		).toThrow(/Bot user ID is required/);
	});

	it("requires a webhook token", () => {
		expect(
			() =>
				new RocketChatAdapter({
					baseUrl: BASE_URL,
					token: TOKEN,
					botUserId: BOT_USER_ID,
				}),
		).toThrow(/Webhook verification is required/);
	});

	it("defaults the username to rocketchat-bot", () => {
		const adapter = createAdapter({ userName: undefined });
		expect(adapter.userName).toBe("rocketchat-bot");
	});

	it("strips trailing slashes from the base URL", async () => {
		mockFetch([
			{
				path: "/chat.getMessage",
				body: { message: restMessage(), success: true },
			},
		]);
		const adapter = createAdapter({ baseUrl: `${BASE_URL}///` });
		await adapter.request("GET", "/chat.getMessage");
		expect(calls[0].url.toString()).toBe(`${BASE_URL}/api/v1/chat.getMessage`);
	});
});

describe("request", () => {
	it("sends X-Auth-Token and X-User-Id headers", async () => {
		mockFetch([{ path: "/chat.getMessage", body: { success: true } }]);
		const { adapter } = await setup();
		await adapter.request("GET", "/chat.getMessage");
		expect(calls[0].headers.get("x-auth-token")).toBe(TOKEN);
		expect(calls[0].headers.get("x-user-id")).toBe(BOT_USER_ID);
	});

	it("sends query parameters, skipping undefined values", async () => {
		mockFetch([{ path: "/rooms.info", body: { success: true } }]);
		const { adapter } = await setup();
		await adapter.request("GET", "/rooms.info", {
			query: { roomId: ROOM_ID, extra: undefined },
		});
		expect(calls[0].url.searchParams.get("roomId")).toBe(ROOM_ID);
		expect(calls[0].url.searchParams.has("extra")).toBe(false);
	});

	it.each([
		[400, ValidationError],
		[401, AuthenticationError],
		[403, PermissionError],
		[404, ResourceNotFoundError],
		[429, AdapterRateLimitError],
		[500, NetworkError],
	])("maps a %i response to %s", async (status, errorClass) => {
		mockFetch([
			{
				path: "/chat.getMessage",
				status,
				body: { success: false, error: "boom" },
			},
		]);
		const { adapter } = await setup();
		await expect(adapter.request("GET", "/chat.getMessage")).rejects.toThrow(errorClass);
	});

	it("throws NetworkError when fetch itself fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("network down"))),
		);
		const { adapter } = await setup();
		await expect(adapter.request("GET", "/chat.getMessage")).rejects.toThrow(NetworkError);
	});
});

describe("handleWebhook", () => {
	it("returns 400 for invalid JSON", async () => {
		const { adapter } = await setup();
		const response = await adapter.handleWebhook(webhookRequest("not json"));
		expect(response.status).toBe(400);
	});

	it("returns 200 for a non-object payload without dispatching", async () => {
		const { adapter, chat } = await setup();
		const response = await adapter.handleWebhook(webhookRequest("null"));
		expect(response.status).toBe(200);
		expect(chat.processMessage).not.toHaveBeenCalled();
	});

	it("rejects a wrong token", async () => {
		const { adapter } = await setup();
		const response = await adapter.handleWebhook(
			webhookRequest(webhookBody({ token: "wrong-token" })),
		);
		expect(response.status).toBe(401);
	});

	it("rejects a missing token", async () => {
		const { adapter } = await setup();
		const response = await adapter.handleWebhook(
			webhookRequest(webhookBody({ token: undefined })),
		);
		expect(response.status).toBe(401);
	});

	it("ignores messages flagged as bot", async () => {
		const { adapter, chat } = await setup();
		const response = await adapter.handleWebhook(webhookRequest(webhookBody({ bot: true })));
		expect(response.status).toBe(200);
		expect(chat.processMessage).not.toHaveBeenCalled();
	});

	it("dispatches a room-level message", async () => {
		const { adapter, chat } = await setup();
		const response = await adapter.handleWebhook(webhookRequest());
		expect(response.status).toBe(200);
		expect(chat.processMessage).toHaveBeenCalledTimes(1);
		const [, threadId, message] = vi.mocked(chat.processMessage).mock.calls[0];
		expect(threadId).toBe(`rocketchat:${ROOM_ID}`);
		expect(message.text).toBe("Hello there");
	});

	it("dispatches a thread-reply message with tmid", async () => {
		const { adapter, chat } = await setup();
		const response = await adapter.handleWebhook(
			webhookRequest(webhookBody({ tmid: "thread1" })),
		);
		expect(response.status).toBe(200);
		const [, threadId] = vi.mocked(chat.processMessage).mock.calls[0];
		expect(threadId).toBe(`rocketchat:${ROOM_ID}:thread1`);
	});
});

describe("parseMessage", () => {
	it("parses a raw message into a normalized Message", () => {
		const { adapter } = { adapter: createAdapter() };
		const message = adapter.parseMessage({
			message: restMessage(),
			roomId: ROOM_ID,
		});
		expect(message.id).toBe("msg1");
		expect(message.threadId).toBe(`rocketchat:${ROOM_ID}`);
		expect(message.text).toBe("Hello there");
		expect(message.author).toMatchObject({
			userId: "U1",
			userName: "ada",
			fullName: "Ada Lovelace",
			isBot: "unknown",
			isMe: false,
		});
	});

	it("detects mentions of the bot username", () => {
		const adapter = createAdapter({ userName: "my-bot" });
		const message = adapter.parseMessage({
			message: restMessage({ msg: "hey @my-bot please help" }),
			roomId: ROOM_ID,
		});
		expect(message.isMention).toBe(true);
	});

	it("marks edited messages", () => {
		const adapter = createAdapter();
		const message = adapter.parseMessage({
			message: restMessage({ editedAt: "2026-10-01T11:00:00.000Z" }),
			roomId: ROOM_ID,
		});
		expect(message.metadata.edited).toBe(true);
		expect(message.metadata.editedAt).toEqual(new Date("2026-10-01T11:00:00.000Z"));
	});
});

describe("postMessage", () => {
	it("posts to a room", async () => {
		mockFetch([
			{
				method: "POST",
				path: "/chat.postMessage",
				body: {
					success: true,
					channel: ROOM_ID,
					ts: 123,
					message: restMessage(),
				},
			},
		]);
		const { adapter } = await setup();
		const result = await adapter.postMessage(`rocketchat:${ROOM_ID}`, "Hello **world**");
		expect(calls[0].body).toEqual({ roomId: ROOM_ID, text: "Hello **world**" });
		expect(result).toMatchObject({
			id: "msg1",
			threadId: `rocketchat:${ROOM_ID}`,
		});
	});

	it("posts a thread reply with tmid", async () => {
		mockFetch([
			{
				method: "POST",
				path: "/chat.postMessage",
				body: {
					success: true,
					channel: ROOM_ID,
					ts: 123,
					message: restMessage({ tmid: "thread1" }),
				},
			},
		]);
		const { adapter } = await setup();
		await adapter.postMessage(`rocketchat:${ROOM_ID}:thread1`, "Reply");
		expect(calls[0].body).toEqual({
			roomId: ROOM_ID,
			text: "Reply",
			tmid: "thread1",
		});
	});

	it("converts emoji placeholders to Rocket.Chat shortcodes", async () => {
		mockFetch([
			{
				method: "POST",
				path: "/chat.postMessage",
				body: {
					success: true,
					channel: ROOM_ID,
					ts: 123,
					message: restMessage(),
				},
			},
		]);
		const { adapter } = await setup();
		await adapter.postMessage(`rocketchat:${ROOM_ID}`, {
			markdown: "Thanks! {{emoji:thumbs_up}}",
		});
		expect(calls[0].body).toMatchObject({
			text: expect.stringContaining(":+1:"),
		});
	});
});

describe("editMessage and deleteMessage", () => {
	it("edits a message", async () => {
		mockFetch([
			{
				method: "POST",
				path: "/chat.update",
				body: { success: true, message: restMessage({ msg: "Updated" }) },
			},
		]);
		const { adapter } = await setup();
		const result = await adapter.editMessage(`rocketchat:${ROOM_ID}`, "msg1", "Updated");
		expect(calls[0].body).toEqual({
			roomId: ROOM_ID,
			msgId: "msg1",
			text: "Updated",
		});
		expect(result.id).toBe("msg1");
	});

	it("deletes a message", async () => {
		mockFetch([
			{
				method: "POST",
				path: "/chat.delete",
				body: { success: true, _id: "msg1", ts: "123" },
			},
		]);
		const { adapter } = await setup();
		await adapter.deleteMessage(`rocketchat:${ROOM_ID}`, "msg1");
		expect(calls[0].body).toEqual({ roomId: ROOM_ID, msgId: "msg1" });
	});
});

describe("reactions", () => {
	it("adds a reaction", async () => {
		mockFetch([{ method: "POST", path: "/chat.react", body: { success: true } }]);
		const { adapter } = await setup();
		await adapter.addReaction(`rocketchat:${ROOM_ID}`, "msg1", "thumbs_up");
		expect(calls[0].body).toEqual({
			messageId: "msg1",
			emoji: "+1",
			shouldReact: true,
		});
	});

	it("removes a reaction", async () => {
		mockFetch([{ method: "POST", path: "/chat.react", body: { success: true } }]);
		const { adapter } = await setup();
		await adapter.removeReaction(`rocketchat:${ROOM_ID}`, "msg1", "thumbs_up");
		expect(calls[0].body).toEqual({
			messageId: "msg1",
			emoji: "+1",
			shouldReact: false,
		});
	});
});

describe("startTyping", () => {
	it("is a no-op", async () => {
		const { adapter } = await setup();
		await expect(adapter.startTyping(`rocketchat:${ROOM_ID}`)).resolves.toBeUndefined();
		expect(calls).toHaveLength(0);
	});
});

describe("fetchMessages", () => {
	it("fetches room-level history, oldest first", async () => {
		mockFetch([
			{
				path: "/rooms.history",
				body: {
					success: true,
					messages: [
						restMessage({ _id: "m2", ts: "2026-10-01T10:02:00.000Z" }),
						restMessage({ _id: "m1", ts: "2026-10-01T10:01:00.000Z" }),
					],
					cursor: { next: null, previous: "cursor-prev" },
				},
			},
		]);
		const { adapter } = await setup();
		const result = await adapter.fetchMessages(`rocketchat:${ROOM_ID}`);
		expect(result.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
		expect(result.nextCursor).toBe("cursor-prev");
	});

	it("fetches thread messages via chat.getThreadMessages", async () => {
		mockFetch([
			{
				path: "/chat.getThreadMessages",
				body: {
					success: true,
					messages: [restMessage({ _id: "m1", tmid: "thread1" })],
					count: 1,
					offset: 0,
					total: 1,
				},
			},
		]);
		const { adapter } = await setup();
		const result = await adapter.fetchMessages(`rocketchat:${ROOM_ID}:thread1`);
		expect(result.messages).toHaveLength(1);
		expect(result.nextCursor).toBeUndefined();
		expect(calls[0].url.searchParams.get("tmid")).toBe("thread1");
	});

	it("returns a nextCursor when more thread messages remain", async () => {
		mockFetch([
			{
				path: "/chat.getThreadMessages",
				body: {
					success: true,
					messages: [restMessage({ _id: "m1", tmid: "thread1" })],
					count: 1,
					offset: 0,
					total: 5,
				},
			},
		]);
		const { adapter } = await setup();
		const result = await adapter.fetchMessages(`rocketchat:${ROOM_ID}:thread1`);
		expect(result.nextCursor).toBe("1");
	});
});

describe("fetchMessage", () => {
	it("returns a single message", async () => {
		mockFetch([
			{
				path: "/chat.getMessage",
				body: { success: true, message: restMessage() },
			},
		]);
		const { adapter } = await setup();
		const message = await adapter.fetchMessage(`rocketchat:${ROOM_ID}`, "msg1");
		expect(message?.id).toBe("msg1");
	});

	it("returns null for a missing message", async () => {
		mockFetch([
			{
				path: "/chat.getMessage",
				status: 404,
				body: { success: false, error: "not found" },
			},
		]);
		const { adapter } = await setup();
		const message = await adapter.fetchMessage(`rocketchat:${ROOM_ID}`, "missing");
		expect(message).toBeNull();
	});
});

describe("fetchThread and fetchChannelInfo", () => {
	it("fetches thread info", async () => {
		mockFetch([
			{
				path: "/rooms.info",
				body: {
					success: true,
					room: {
						_id: ROOM_ID,
						name: "general",
						t: "c",
						topic: "General chat",
					},
				},
			},
		]);
		const { adapter } = await setup();
		const thread = await adapter.fetchThread(`rocketchat:${ROOM_ID}`);
		expect(thread).toMatchObject({
			id: `rocketchat:${ROOM_ID}`,
			channelId: `rocketchat:${ROOM_ID}`,
			channelName: "general",
			isDM: false,
		});
	});

	it("flags a DM room", async () => {
		mockFetch([
			{
				path: "/rooms.info",
				body: { success: true, room: { _id: "D1", t: "d" } },
			},
		]);
		const adapter = createAdapter();
		const chat = createMockChatInstance();
		await adapter.initialize(chat);
		const thread = await adapter.fetchThread("rocketchat:D1");
		expect(thread.isDM).toBe(true);
	});

	it("fetches channel info", async () => {
		mockFetch([
			{
				path: "/rooms.info",
				body: {
					success: true,
					room: { _id: ROOM_ID, fname: "General", t: "c" },
				},
			},
		]);
		const { adapter } = await setup();
		const info = await adapter.fetchChannelInfo(`rocketchat:${ROOM_ID}`);
		expect(info).toMatchObject({
			id: `rocketchat:${ROOM_ID}`,
			name: "General",
			isDM: false,
		});
	});
});

describe("thread and channel ID helpers", () => {
	it("derives the channel ID from a thread ID", () => {
		const adapter = createAdapter();
		expect(adapter.channelIdFromThreadId(`rocketchat:${ROOM_ID}:thread1`)).toBe(
			`rocketchat:${ROOM_ID}`,
		);
	});

	it("rejects a malformed thread ID", () => {
		const adapter = createAdapter();
		expect(() => adapter.decodeThreadId("not-a-thread-id")).toThrow(ValidationError);
	});
});

describe("getUser", () => {
	it("maps a bot-type user to isBot: true", async () => {
		mockFetch([
			{
				path: "/users.info",
				body: {
					success: true,
					user: {
						_id: "U2",
						username: "review-bot",
						name: "Review Bot",
						type: "bot",
					},
				},
			},
		]);
		const { adapter } = await setup();
		const user = await adapter.getUser("U2");
		expect(user).toMatchObject({
			userId: "U2",
			userName: "review-bot",
			fullName: "Review Bot",
			isBot: true,
		});
	});

	it("maps a normal user to isBot: false", async () => {
		mockFetch([
			{
				path: "/users.info",
				body: {
					success: true,
					user: { _id: "U1", username: "ada", type: "user" },
				},
			},
		]);
		const { adapter } = await setup();
		const user = await adapter.getUser("U1");
		expect(user?.isBot).toBe(false);
	});

	it("returns null for a lookup failure", async () => {
		mockFetch([{ path: "/users.info", status: 404, body: { success: false } }]);
		const { adapter } = await setup();
		const user = await adapter.getUser("missing");
		expect(user).toBeNull();
	});
});
