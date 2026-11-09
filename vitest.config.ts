import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["@chat-adapter/tests/setup"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts"],
			thresholds: {
				lines: 40,
				branches: 35,
				functions: 35,
				statements: 40,
			},
		},
	},
});
