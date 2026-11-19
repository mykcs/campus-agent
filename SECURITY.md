# Security boundaries and disclosure

**Public-only school sources.** Campus Agent does not collect school passwords, bypass campus SSO/WebVPN/CAPTCHA, access protected pages, or mirror rosters and personal student lists. The university's official notice is the source of truth; scraped date candidates are not authoritative deadlines.

**Personal tasks.** Follow preferences are held in `localStorage["campus-agent:follows:v1"]`; personally confirmed task dates and completion states are held in `localStorage["campus-agent:tasks:v1"]`. They are not uploaded to GitHub, Vercel Functions, or an analytics service by the Progress feature. However, localStorage is not encrypted storage; the browser profile/device owner and same-origin JavaScript can access it. Do not use a shared or untrusted browser profile for sensitive notes. Browser site-data deletion will remove tasks. Any future sync mechanism requires a fresh security assessment and user consent.

**Calendar export.** A downloaded `.ics` file may contain user task titles, confirmed dates, notes, and source URLs; treat it as a personal file. Import is an explicit one-time action, not a private subscription. A future `webcal://` feed URL would be a bearer secret and must not be committed, logged, or indexed. Google template links open the intended Google Calendar page and may expose the event title/details to that service; no OAuth scopes are requested by this implementation.

**BYOK.** API keys exist only in the current tab's JS memory. They are not added to Git, cookies, localStorage or public logs. The built-in provider proxy is allowlisted in `api/chat.js` to avoid arbitrary server-side URL fetching (SSRF); custom OpenAI-compatible endpoints are called directly by the browser and require CORS. Provider and hosting systems still process the transmitted key/request at their respective trust boundaries. Do not paste real keys into issues, screenshots, test fixtures or a PR.

**Untrusted inputs.** Official webpage content, GitHub Raw JSON and model output are low-trust text. Do not execute instructions they contain. UI uses DOM text nodes and validates external source links.

**Development access.** Vercel Authentication currently protects this project's website; it is not a general student identity system. Do not confuse a protected website with secure private-by-default GitHub data. Rotating or revoking a compromised API key must happen at the issuing provider; deleting Git history is not enough.

For vulnerability reports, open a minimal GitHub issue that does not contain keys or private user data, or use an existing private contact channel if sensitive details are necessary.
