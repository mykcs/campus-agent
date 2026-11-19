# Campus Agent — publicly accessible university notice radar

[![Official source: ZJU AI admissions](https://img.shields.io/badge/source-ZJU%20AI%20admissions-367158)](https://ai.zju.edu.cn/zstz/list1.htm)

An independent, open-source university notice reader with optional **bring-your-own-key** AI. It is **not affiliated with** any university.

## What actually works in v0.1
- Reads [public notice JSON](https://github.com/mykcs/campus-agent-data/blob/main/data/notices.json), maintained in a **separate repository**; no university login, password, WebVPN, or protected data.
- Search, category filtering, official links, dated sources, linked document attachments.
- Read-only date **candidates**, never falsely presented as verified application deadlines.
- Free, model-less local lookup; optional Kimi, DeepSeek, OpenAI or browser-CORS-compatible custom API endpoint via BYOK.
- Data health/staleness labels (GitHub Actions schedules can fail or be delayed).
- Lightweight static PWA; no Next.js build, no Cloudflare.

## Why two repositories?
\`campus-agent\` connects to Vercel Hobby. \`campus-agent-data\` contains the scheduled GitHub Actions scraper. Its routine data commits **do not touch the website repository**, and therefore **do not trigger Vercel CI, builds, or deployments**. Publishing website code does create a Vercel deployment, subject to Hobby limits. The model-less notice reader does not invoke Vercel Functions.

## Local demo
Serve this directory with any static web server:
\`\`\`sh
python3 -m http.server 3000 --directory public
\`\`\`
Then visit \`http://localhost:3000\`. The model-less UI works. To test \`/api/chat\` use a Vercel deployment or \`vercel dev\`.

No build command is needed on Vercel. Framework Preset: **Other**; Output Directory: **public**. An API function exists in \`api/chat.js\`; it is invoked **only** when a user asks a question after providing their own API key.

## Privacy / model costs
- No model API Key is saved in Git, the data repo, localStorage, or a database. API Keys exist in the current page's memory only; re-enter after refresh.
- For built-in providers, the Vercel Function forwards one request and does not save the key. Server/request metadata can still be handled by the hosting provider; this is not end-to-end secrecy.
- A custom OpenAI-compatible endpoint uses browser-direct requests: the **entered HTTPS provider receives the key**. It works only if the provider allows CORS.
- The AI provider may charge the user and receive the selected public notice excerpts. No AI call runs during scheduled collection.
- This is an early research product, not an authoritative admission or scholarship advisor. Always check the official site.

## Limits and next phases
- Currently **only ZJU AI School public admissions** are indexed, not all of Zhejiang University, MIT, or Tsinghua.
- Date extraction is heuristic; not all dates indicate deadlines or eligibility.
- No email/push reminder delivery yet, no user profile, no login integration, no access control for public visitors.
- GitHub Actions are not a hard real-time scheduler. The app's stale data alert does not replace external alerting.
- Hobby is for personal/non-commercial projects within usage limits.

## Security tests
\`\`\`sh
node --check public/app.js
node --check api/chat.js
python3 -m json.tool vercel.json >/dev/null
\`\`\`
See [SECURITY.md](SECURITY.md) and [the public data collector](https://github.com/mykcs/campus-agent-data).

MIT licensed app code. School-authored content remains the property of its respective owners.
