# Dev — 实现的唯一技术入口

从 [ARCHITECTURE.md](ARCHITECTURE.md) 理解数据与依赖，从 [TASK-STATE-AND-ICS.md](TASK-STATE-AND-ICS.md) 理解申请任务，再查看 [DECISION-001-CALENDAR-OWNERSHIP.md](DECISION-001-CALENDAR-OWNERSHIP.md) 了解为什么不把全部日历系统搬进网站。修改前先看 [TESTING.md](TESTING.md)。

关键代码：`public/app.js`（公开通知和关注）、`public/taskboard.js`（浏览器状态）、`public/taskboard-core.js`（可独立测试的日期/ICS 核心）、`api/chat.js`（按需 BYOK）、`public/sw.js`（离线 shell）。

站点 `campus-agent` 由 Vercel Hobby 管理；`campus-agent-data` 的定时 GitHub Actions 负责公开网页采集。**只读网页与本地任务不依赖 Vercel Function。** 不得把私人任务或 API Key 推到公开 GitHub。
