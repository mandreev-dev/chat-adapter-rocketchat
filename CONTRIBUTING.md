# Contributing to chat-adapter-rocketchat

First off, thank you for considering contributing! It's people like you that make this project great.

## Setup

1. Fork and clone the repository
2. Install [pnpm](https://pnpm.io/) if you don't have it
3. Run `pnpm install` to install dependencies
4. Create a branch for your changes

## Available Scripts

| Command             | Description                      |
| -------------------- | --------------------------------- |
| `pnpm build`        | Build the package                |
| `pnpm test`         | Run tests with coverage          |
| `pnpm test:watch`   | Run tests in watch mode          |
| `pnpm typecheck`    | Type-check with TypeScript       |
| `pnpm lint`         | Lint with ESLint                 |
| `pnpm lint:fix`     | Lint and auto-fix issues         |
| `pnpm format`       | Format code with Prettier        |
| `pnpm format:check` | Check formatting without writing |

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are enforced via commitlint.

Format:

```
type(scope): description
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples:**

- `feat: add support for slash commands`
- `fix: handle thread-reply dispatch edge case`
- `docs: update README with new config option`
- `test: add coverage for reaction handling`

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Ensure all checks pass: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`
5. Add a [changeset](#changesets) describing your change
6. Open a pull request

### Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

After making changes, run:

```sh
pnpm changeset
```

Select the change type (`patch`, `minor`, or `major`) and write a brief description. Commit the generated `.changeset/*.md` file with your PR.

When your PR is merged to `main`, a "Version Packages" PR will be created or updated automatically. Once that PR is merged, the package is published to npm.

## Code Style

- TypeScript with strict mode
- Tabs for indentation (4 spaces width)
- Double quotes for strings
- Trailing commas everywhere
- No unused variables (prefix with `_` if intentionally unused)

## Reporting Issues

- Use [GitHub Issues](https://github.com/mandreev-dev/chat-adapter-rocketchat/issues)
- Include your Rocket.Chat server version
- Include your Node.js version
- Provide a minimal reproduction when possible

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
