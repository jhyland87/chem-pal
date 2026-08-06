# Security Policy

ChemPal is a client-side browser extension (Manifest V3, Chrome and Firefox). It
runs locally, stores its cache on your device, and queries public supplier
storefronts on your behalf — it has no backend server and collects no data. See
the [Privacy Policy](../pages/PRIVACY.md) for exactly what stays local and what is
sent to the suppliers you search.

## Supported versions

Only the latest released version receives security fixes. Please make sure you're
on the current release (available on the
[Chrome Web Store](https://chromewebstore.google.com/detail/facakdliomkjhegdhjimfjlcggfnpfnd)
or the [releases page](https://github.com/jhyland87/chem-pal/releases/latest))
before reporting.

| Version | Supported |
| ------- | --------- |
| Latest release (1.7.x) | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

- **Preferred:** use GitHub's private vulnerability reporting —
  **Security → Report a vulnerability** on the
  [repository](https://github.com/jhyland87/chem-pal/security/advisories/new).
- **Alternatively:** email **jhyland87@gmail.com** with the details.

Please include:

- The extension version and browser (Chrome/Firefox) affected.
- Steps to reproduce, or a proof of concept.
- The impact — what an attacker could do.

This is an independent, open-source hobby project maintained in spare time, so
there's no formal SLA — but we aim to acknowledge reports within about a week and
will keep you posted on progress. Please give us a reasonable chance to release a
fix before disclosing the issue publicly. Thanks for helping keep ChemPal users
safe.
