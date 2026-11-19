# Campus Agent — a focused campus inbox

An independent, open-source university notice reader and optional **bring-your-own-key** AI assistant. Not affiliated with Zhejiang University, MIT or Tsinghua.

## v0.2 interface
- Minimal, reader-first notification inbox (desktop and mobile PWA).
- Clicking a **notice title or ↗ opens the original university URL** directly in a new tab. AI explanation is a separate optional action.
- `我的关注`: follow multiple colleges simultaneously; optionally add extra topics that **union with** those colleges (e.g. AI + Computer Science + Software **plus scholarships from other indexed departments**).
- `我的关注` vs. `全部公开通知`, keyword search, category filter, newest/oldest sort.
- Preferences persist **only in the current browser's localStorage**; no account or school login required for notice browsing. User's API Key is **not** stored in localStorage.
- Each source has an explicit monitoring state. Some college notices come from ZJU public search and are **partial coverage**, not guaranteed complete department feeds.
- Optional BYOK Kimi / DeepSeek / OpenAI / custom OpenAI-compatible API. Without a key, the assistant only returns locally ranked official notice links.

## Data collection vs Vercel Hobby

The independent [campus-agent-data](https://github.com/mykcs/campus-agent-data) repository runs GitHub Actions every two hours. Its routine data commits do **not** touch this Vercel project, so they **do not cause Vercel CI/builds/deployments**. Changes to the website repository, or a manual Vercel deployment, do trigger normal Hobby deployment usage.

The website reads a public JSON snapshot from GitHub Raw. There is no Cloudflare, private school SSO, school password, or scraping of login-required pages.

## Run locally

~~~sh
python3 -m http.server 3000 --directory public
~~~

Visit http://localhost:3000. To test the `/api/chat` function use `vercel dev` or a Vercel preview. No frontend build step; Output Directory `public`.

## Security and limitations

- Public university content and model output are untrusted. Every notice keeps an official source URL; no automated application submission is attempted.
- The University-wide scholarship search and the Computer Science/Software School search are ranked **partial** indexes, not complete feeds. A missing result is not proof that an announcement does not exist.
- Automated date extraction only supplies hints, not verified personal deadlines or eligibility.
- No automatic email/SMS/push reminder delivery yet. GitHub Actions cron can be delayed or skipped.
- Model API Keys are kept in tab memory only. Built-in providers are sent to their respective providers via the Vercel Function; custom endpoints are browser-direct and require CORS. Never paste real keys into issue reports.
- The site is currently behind Vercel Authentication during development; public student accounts and shared profiles are not yet built.
- Vercel Hobby is for personal / non-commercial use within current quotas.

Open-source site code is MIT licensed. University-authored notices remain the property of their respective owners.

See [SECURITY.md](SECURITY.md) and [data source status](https://github.com/mykcs/campus-agent-data).
