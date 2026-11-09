# Security Policy

## Supported Versions

Only the latest version is actively supported with security updates.

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |
| older   | No        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them via [GitHub Security Advisories](https://github.com/mandreev-dev/chat-adapter-rocketchat/security/advisories/new).

Please include:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Possible mitigations

You can expect a response within 7 days. If the vulnerability is accepted, a fix will be prioritized and a security advisory will be published.

## Security Best Practices

When using this adapter in production:

- Store your Rocket.Chat auth token and webhook token in environment variables or a secrets manager
- Use HTTPS for all Rocket.Chat API communications
- Keep your dependencies up to date
- Review the permissions granted to your bot user
