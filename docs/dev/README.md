# Dev — 实现的唯一技术入口

从 [ARCHITECTURE.md](ARCHITECTURE.md) 理解数据与依赖，从 [TASK-STATE-AND-ICS.md](TASK-STATE-AND-ICS.md) 理解申请任务，再查看 [DECISION-001-CALENDAR-OWNERSHIP.md](DECISION-001-CALENDAR-OWNERSHIP.md) 了解为什么不把全部日历系统搬进网站。修改前先看 [TESTING.md](TESTING.md)。

关键代码：`public/app.js`（公开通知和关注）、`public/taskboard.js`（浏览器状态）、`public/taskboard-core.js`（可独立测试的日期/ICS 核心）、`api/chat.js`（按需 BYOK）、`public/sw.js`（离线 shell）。

站点 `campus-agent` 由 Vercel Hobby 管理；`campus-agent-data` 的定时 GitHub Actions 负责公开网页采集。**只读网页与本地任务不依赖 Vercel Function。** 不得把私人任务或 API Key 推到公开 GitHub。

## Website acceptance map

| Area | Existing implementation and acceptance |
| --- | --- |
| Agent reading | public/agent/site.json, public/llms.txt and tests/agent-reader.test.cjs; verify source-owner links and explicit copy. |
| Design | [Design](../design/README.md), public/styles.css and scripts/check-site-design.cjs; no separate style owner. |
| Responsive | Desktop and Chrome 440×956 DPR3 touch; verify notices, progress, navigation, and relevant offline behavior. |
| Expression | [Wish](../wish/README.md) and notice source links; deadline/source/unknown state must remain distinct. |
| Engineering | npm ci and npm run check, plus npm run test:browser as scoped; separate site logic from data ingestion. |
| CI / publication | Existing checks.yml, [TESTING](TESTING.md), and actual Vercel release state. Do not add a hosting provider or redeploy when the independent notice catalog updates. |
| Output safety | Public notices only; never expose browser-local tasks, personal information, API keys or restricted school content. |
| Accessibility/performance | Existing browser checks; verify keyboard, labels, contrast, overflow and relevant loading/offline behavior; report unrun checks. |
| Governance | AGENTS, Wish, Design, Dev and independent notice data owner retain their separate roles. |

The map does not certify production, permissions or reader behavior by itself.

Feature-level goals and protected semantics: [Intent](../intent/README.md). This file retains its existing ownership and history.
