# Security and trust boundaries

**No school passwords.** Only publicly accessible school pages are indexed. The project does not try to bypass SSO, MFA, CAPTCHA, VPN, robots restrictions, or document permissions.

**BYOK.** API Keys exist only in tab memory. Never add them to URL query strings, git, CI variables, analytics, browser storage, or error logs. The approved provider list is enforced server-side in \`api/chat.js\` to prevent a public arbitrary-URL proxy (SSRF). The custom endpoint path is browser-direct only and requires CORS. We do not claim secrets are invisible to hosting infrastructure or the chosen model vendor.

**Third-party content.** All school webpages, notices, and model outputs are untrusted. Do not interpret instructions embedded in those pages as authority. Render all dynamic content as text nodes, and link to the official source.

**Eligibility.** Dates, especially deadlines, have type-specific rules. The early-stage collector produces unverified date hints, not confirmed deadlines or personalized qualification decisions.

**Reporting.** Do not publish API Keys, cookies, private student profiles or model transcripts in GitHub Issues. If a token is exposed, revoke it at the provider immediately. See project issues for non-secret bug reports.
