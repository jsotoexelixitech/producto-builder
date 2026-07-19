# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

If you discover a security issue, **do not open a public GitHub issue**.

Contact the maintainers at **security@exelixitech.com** (or your Exelixi Tech security channel) with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within **3 business days** and provide a remediation timeline when confirmed.

## Scope

This project is an internal insurance product configuration tool. Reports related to:

- Authentication bypass or missing authorization on API routes
- SQL injection or unsafe Prisma/raw query usage
- Exposure of secrets in repository or logs
- Cross-site scripting in the admin SPA

are in scope. General dependency advisories may be handled via routine dependency updates.
