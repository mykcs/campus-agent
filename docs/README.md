# Campus Agent 文档导航

目标：让开发者和 Agent **尽快找到唯一权威文件**，而不是为文件夹数量增加维护负担。产品规划、设计和技术事实分开；已运行事实以 GitHub/Vercel 的实时状态为准。

| 入口 | 职责 | 首选阅读 |
| --- | --- | --- |
| [Agents](agents/README.md) | Agent 怎样安全接手与操作 | [运行守则](agents/INVARIANTS.md) |
| [Markdown](markdown/README.md) | 文档结构、写作约定、模板 | [模板](markdown/TEMPLATE.md) |
| [Wish](wish/README.md) | 用户真实愿望、边界、验收标准 | [产品愿望](wish/PRODUCT-WISHES.md) |
| [Dev](dev/README.md) | 架构、数据合同、测试与技术决策 | [系统架构](dev/ARCHITECTURE.md) |
| [Design](design/README.md) | 信息架构、视觉表达和交互规范 | [Progress UX](design/PROGRESS-UX.md) |

**页面源**：`src/pages/`、`src/layouts/` 与 `src/components/`；`npm run build` 生成 `dist/`。**业务源码是真实执行入口**：`public/app.js`（通知）、`public/taskboard.js`（进度与任务）、`public/taskboard-core.js`（日期/ICS）、`api/chat.js`（BYOK）。

**数据源不在本仓库**：[campus-agent-data](https://github.com/mykcs/campus-agent-data) 有独立的采集脚本、定时工作流和数据质量证据。该仓库提交不应触发 Vercel 网站重新部署。

**状态定义**：已实现必须有源码和测试；已上线必须有指定 deployment + 页面读回；计划不等于已交付；部分覆盖不等于来源全量监控。
