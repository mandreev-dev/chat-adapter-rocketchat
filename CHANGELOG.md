# Changelog

All notable changes to this project will be documented in this file. See [CONTRIBUTING.md](CONTRIBUTING.md) for instructions on how to add a changeset.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-09

### Added

- Initial release
- Rocket.Chat REST API client with personal access token authentication (`X-Auth-Token` / `X-User-Id`)
- Outgoing Webhook handling for inbound messages, with timing-safe token verification
- Thread ID encoding/decoding (room-level and thread-reply)
- Message posting, editing, deletion
- Reactions (add/remove)
- Message history (`fetchMessages`, `fetchMessage`, `fetchThread`, `fetchChannelInfo`)
- Format conversion (Rocket.Chat markdown <-> AST), including table-to-ASCII-code-block fallback
- Error mapping to Chat SDK error types

[0.1.0]: https://github.com/mandreev-dev/chat-adapter-rocketchat/releases/tag/v0.1.0
