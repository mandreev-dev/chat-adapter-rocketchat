import { describe, expect, it } from "vitest";
import { RocketChatFormatConverter } from "./markdown";

describe("RocketChatFormatConverter", () => {
	const converter = new RocketChatFormatConverter();

	describe("toAst", () => {
		it("should parse plain text", () => {
			const ast = converter.toAst("Hello world");
			expect(ast.type).toBe("root");
			expect(ast.children.length).toBeGreaterThan(0);
		});

		it("should parse Rocket.Chat bold (*text*) as standard bold", () => {
			const ast = converter.toAst("*bold text*");
			expect(ast.children[0]).toMatchObject({
				type: "paragraph",
				children: [{ type: "strong" }],
			});
		});

		it("should parse italic (_text_)", () => {
			const ast = converter.toAst("_italic text_");
			expect(ast.children[0]).toMatchObject({
				type: "paragraph",
				children: [{ type: "emphasis" }],
			});
		});

		it("should parse Rocket.Chat strikethrough (~text~) as standard", () => {
			const ast = converter.toAst("~strikethrough~");
			expect(ast.children[0]).toMatchObject({
				type: "paragraph",
				children: [{ type: "delete" }],
			});
		});

		it("should not merge bold spans across newlines", () => {
			const ast = converter.toAst("*bold1*\nsome text\n*bold2*");
			const result = converter.fromAst(ast);
			expect(result).toContain("*bold1*");
			expect(result).toContain("*bold2*");
		});

		it("should parse code blocks", () => {
			const ast = converter.toAst("```\ncode\n```");
			expect(ast.children[0]).toMatchObject({ type: "code", value: "code" });
		});

		it("preserves code starting immediately after the opening fence", () => {
			const ast = converter.toAst("Here you go:\n```first line\nsecond line```");
			expect(ast.children[0]).toMatchObject({ type: "paragraph" });
			expect(ast.children[1]).toMatchObject({
				type: "code",
				lang: null,
				value: "first line\nsecond line",
			});
		});

		it("does not rewrite bold or strikethrough inside fenced code", () => {
			const ast = converter.toAst("```int *a = *b; ~x~```");
			expect(ast.children[0]).toMatchObject({
				type: "code",
				value: "int *a = *b; ~x~",
			});
		});

		it("separates a fence from surrounding text on the same line", () => {
			const ast = converter.toAst("before ```code``` after");
			const types = ast.children.map((child) => child.type);
			expect(types).toEqual(["paragraph", "code", "paragraph"]);
		});

		it("should parse thematic breaks", () => {
			const ast = converter.toAst("above\n\n---\n\nbelow");
			const types = ast.children.map((child) => child.type);
			expect(types).toEqual(["paragraph", "thematicBreak", "paragraph"]);
		});
	});

	describe("fromAst", () => {
		it("should stringify a simple AST", () => {
			const ast = converter.toAst("Hello world");
			const result = converter.fromAst(ast);
			expect(result).toContain("Hello world");
		});

		it("should convert standard bold to Rocket.Chat single-asterisk bold", () => {
			const ast = converter.toAst("**bold text**");
			const result = converter.fromAst(ast);
			expect(result).toContain("*bold text*");
			expect(result).not.toContain("**bold text**");
		});

		it("should convert standard strikethrough to Rocket.Chat single-tilde style", () => {
			const ast = converter.toAst("~~strikethrough~~");
			const result = converter.fromAst(ast);
			expect(result).toContain("~strikethrough~");
			expect(result).not.toContain("~~strikethrough~~");
		});

		it("should preserve escaped asterisks and tildes as literals", () => {
			const ast = converter.toAst("a \\* b and c \\~ d");
			const result = converter.fromAst(ast);
			expect(result).toBe("a * b and c ~ d");
		});

		it("should keep standard italic as Rocket.Chat underscore italic", () => {
			const result = converter.renderPostable({ markdown: "_italic text_" });
			expect(result).toContain("_italic text_");
			expect(result).not.toContain("*italic text*");
		});

		it("should handle bold and italic together", () => {
			const result = converter.renderPostable({
				markdown: "**bold** and _italic_",
			});
			expect(result).toContain("*bold*");
			expect(result).toContain("_italic_");
		});

		it("should convert headings to bold text", () => {
			const ast = converter.toAst("# Main heading");
			const result = converter.fromAst(ast);
			expect(result).toContain("*Main heading*");
			expect(result).not.toContain("#");
		});

		it("should flatten bold inside headings to avoid triple asterisks", () => {
			const result = converter.renderPostable({
				markdown: "## **Choose React if:**",
			});
			expect(result).toContain("*Choose React if:*");
			expect(result).not.toContain("***");
		});

		it("should convert thematic breaks to a text separator", () => {
			const ast = converter.toAst("above\n\n---\n\nbelow");
			const result = converter.fromAst(ast);
			expect(result).toContain("━━━");
			expect(result).toContain("above");
			expect(result).toContain("below");
		});

		it("should convert tables to an ASCII code block", () => {
			const ast = converter.toAst("| A | B |\n| --- | --- |\n| 1 | 2 |");
			const result = converter.fromAst(ast);
			expect(result).toBe("```\nA | B\n--|--\n1 | 2\n```");
		});
	});

	describe("renderPostable", () => {
		it.each([
			["(~80 % easy)", "(~80 % easy)"],
			["~45 min, Pace ~6:29/km", "~45 min, Pace ~6:29/km"],
			[String.raw`C:\Users\Luis and foo_bar`, String.raw`C:\Users\Luis and foo_bar`],
			[String.raw`Literal \*\*stars\*\*`, String.raw`Literal \*\*stars\*\*`],
			[String.raw`\_init\_ and \~gone\~`, String.raw`\_init\_ and \~gone\~`],
			["foo_bar_baz", "foo_bar_baz"],
			[String.raw`a \* b and c \~ d`, "a * b and c ~ d"],
			["*un*believable", "_un_believable"],
			["line one  \nline two", "line one\nline two"],
			[
				"- **Monday** — Rest\n- _Tuesday_ — ~~Tempo~~",
				"- *Monday* — Rest\n- _Tuesday_ — ~Tempo~",
			],
			["**bold _italic_ ~~strike~~**", "*bold _italic_ ~strike~*"],
			["_use snake_case here_", "_use snake_case here_"],
			["**2 * 3 = 6**", "*2 * 3 = 6*"],
			["~~rate ~5 per day~~", "~rate ~5 per day~"],
			["_a_b_c_", "_a_b_c_"],
		])("preserves literal text and formatting in %s", (markdown, expected) => {
			expect(converter.renderPostable({ markdown })).toBe(expected);
		});

		it("should render a plain string", () => {
			const result = converter.renderPostable("Hello world");
			expect(result).toBe("Hello world");
		});

		it("should render a raw message", () => {
			const result = converter.renderPostable({ raw: "raw content" });
			expect(result).toBe("raw content");
		});

		it("should render a markdown message", () => {
			const result = converter.renderPostable({
				markdown: "**bold** text",
			});
			expect(result).toContain("bold");
		});

		it("should render an AST message", () => {
			const ast = converter.toAst("Hello from AST");
			const result = converter.renderPostable({ ast });
			expect(result).toContain("Hello from AST");
		});

		it("should correctly convert a complex AI-style markdown response", () => {
			const markdown = [
				"# The Answer: **It Depends!**",
				"",
				"There's no universal *better* choice.",
				"",
				"## **Choose React if:**",
				"- Building **large-scale** apps",
				"- Need the biggest *ecosystem*",
				"- **Examples:** Facebook, Netflix",
				"",
				"## **Choose Vue if:**",
				"- Want *faster* learning curve",
				"- Prefer ~~complex~~ cleaner templates",
				"",
				"---",
				"",
				"## Real Talk:",
				"**All three are excellent.** Learn *React* first!",
			].join("\n");

			const result = converter.renderPostable({ markdown });

			expect(result).toBe(`*The Answer: It Depends!*

There's no universal _better_ choice.

*Choose React if:*

- Building *large-scale* apps
- Need the biggest _ecosystem_
- *Examples:* Facebook, Netflix

*Choose Vue if:*

- Want _faster_ learning curve
- Prefer ~complex~ cleaner templates

━━━

*Real Talk:*

*All three are excellent.* Learn _React_ first!`);
		});
	});
});

describe("parseIncoming budget", () => {
	const converter = new RocketChatFormatConverter();
	const markers = "_a".repeat(2100);
	const unparsed = (value: string) => ({
		text: value,
		formatted: {
			type: "root",
			children: [{ type: "paragraph", children: [{ type: "text", value }] }],
		},
	});

	it("counts text after a fence closed inline", () => {
		const input = `\`\`\`\ncode\`\`\`\n${markers}`;
		expect(converter.parseIncoming(input)).toEqual(unparsed(input));
	});

	it("skips text inside a fence closed inline", () => {
		const input = `\`\`\`\n${markers}\`\`\``;
		const { formatted } = converter.parseIncoming(input);
		expect(formatted).toEqual(converter.toAst(input));
		expect(formatted.children).toEqual([
			expect.objectContaining({ type: "code", value: markers }),
		]);
	});
});
