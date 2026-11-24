# Campus Agent · 校园通知与申请进度

> Independent, open-source campus information assistant. 不是浙江大学、MIT 或清华大学的官方产品。

**目标**：学生不用登录学校内网，也能发现分散在公开大学网站上的通知，按学校/学院/主题筛选，通过官方原文核对申请条件，并把重要的申请窗口转化为能追踪的 Progress 任务。

**开发站点**：[Campus Agent on Vercel Hobby](https://campus-agent-sigma.vercel.app)（当前开启 Vercel Authentication 访问保护）。本仓库是公开代码；访问网站和访问 GitHub 源码是两种不同的权限。

## 现在可以做什么？

| 体验 | 状态 | 说明 |
| --- | --- | --- |
| 公开通知收件箱 | 已实现 | 浙大 AI / 计算机 / 软件 / 材料学院 + 校级奖学金部分公开信息，标题直达官方原文 |
| 我的关注 | 已实现 | 多学院 + 跨学院主题的并集筛选，选项留在当前浏览器 |
| BYOK 校园问答 | 可选 | 不配置 AI Key 可以本地检索；Kimi / DeepSeek / OpenAI / 自定义兼容接口按用户自己模型调用 |
| Progress 申请时间条 | 本地 MVP | 从官方公告选任务，**用户核对日期**后显示时间经过比例、还剩几天、逾期 |
| 今日看板 | 本地 MVP | 7天内未完成、逾期、进行中事项；用户自己标记完成，刷新保留 |
| Apple/Google 日历 | 单次输出 | 下载 RFC5545 `.ics`（可在支持的日历 App 导入），或一键预填 Google 日历事件；**尚无自动订阅和双向完成同步** |
| 后台推送、跨设备个人账号 | 未实现 | 手机通知、私人订阅 URL 和服务器个人状态需要独立设计 |

**注意**：高校公示/人员名单只保留标题与官方链接。计算机学院、软件学院和校级奖学金的一些记录来自公开搜索，属于 **partial coverage（部分覆盖）**。系统无法承诺不会漏掉所有学校通知。

## 为什么不用一个完整的日历 App？

这个产品需要的是 **公告 → 核对截止日期 → 今日任务 → 完成状态**。日历软件擅长把已经确认的事件放进用户原有的时间安排；但 Apple 的订阅日历只读，Google 写入要 OAuth，现阶段不宜把个人完成状态交出去。详细决策见 [ADR-001](docs/dev/DECISION-001-CALENDAR-OWNERSHIP.md)。

使用步骤：在「我的动态」点击官方通知阅读原文 → 点击「＋跟踪」或「进度与今日任务」→ 核对并填写自己的申请截止日 → 在 Progress 里查看从公告日期到截止日的长条以及还剩几天 → 在今日看板手动改为已完成；可选导出一次性日历文件。

**时间经过≠任务完成率**；`date_candidates` 是未经确认的日期线索，不能直接作为截止日，更不能据此判定申请资格。

## 系统架构：免费优先，不依赖后台 ChatGPT

```text
公开大学网站 → campus-agent-data（GitHub Actions 定时采集）
                     │  public data/notices.json
                     ▼
Campus Agent 网站（Vercel Hobby，Astro 静态构建 / 可选 API）
    ├── 浏览器公开公告搜索与关注（零 AI 费用）
    ├── 浏览器 localStorage 的个人任务与 Progress（零 AI 费用）
    ├── 浏览器即时生成一次性 .ics / Google 日历模板
    └── 用户自带 API Key → 可选 AI 解读
```

公开数据的独立仓库：[mykcs/campus-agent-data](https://github.com/mykcs/campus-agent-data)。数据提交只更新另一个 GitHub 仓库，不触发本网站 Vercel 重建。**只修改网站代码或主动部署网站，才产生新的 Vercel build/deployment。** 没有 Cloudflare、私人校园账户抓取，也没有强制模型费用。

## 给 Agent 读

网站的 [只读阅读页](https://campus-agent-sigma.vercel.app/agent/) 提供 `llms.txt`、同源结构化 `agent/site.json` 及阅读规约。目录不含个人关注、任务或模型凭据；真实通知以学校原文与独立公开数据源为准。维护目录时修改 `public/llms.txt`，执行 `npm run agent:index` 更新 JSON；现有 `npm run check` 拒绝不一致的生成物。

## 运行与测试

需要现代浏览器、Node.js（以 package.json engines 为准）和 npm。使用 Astro 静态输出及 Tailwind CSS 4；不在浏览器中引入新的 UI 框架运行时。现有 `public/styles.css` 是语义设计 token 的唯一 owner，Tailwind 工具类从同一尺度读取，不启用会改变现有控件默认样式的 Preflight。网站输出为 `dist/`，原有 `/api/chat.js` 仍由 Vercel 承载。

```bash
npm ci
npm run dev
npm run check
npm run test:browser
```

浏览器测试对实际构建产物执行 Chromium/WebKit 的 1440×900 桌面、440×956 DPR3 触控手机和 390px 窄屏回归。检查各业务视图、弹窗、日期、ICS、个人状态和 Agent 静态目录；Chromium 另测离线 shell。测试使用合成公开数据，不调用实际模型服务、Google OAuth 或 iOS 原生日历。生产受保护站点需独立授权读回验证。

## 文档体系

| 目录 | 存放内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 项目 Agent 第一动作、安全边界和正确的文档入口 |
| [docs/agents/](docs/agents/README.md) | Agent 职责与不变量 |
| [docs/markdown/](docs/markdown/README.md) | Markdown 写作规则及模板 |
| [docs/wish/](docs/wish/README.md) | 用户真实愿望与优先级 |
| [docs/dev/](docs/dev/README.md) | 架构、申请状态模型、ICS、测试、ADR |
| [docs/design/](docs/design/README.md) | 交互流程、设计准则和成熟产品参考 |
| [docs/README.md](docs/README.md) | 文档总入口 |

技术与执行事实以 GitHub/Vercel 的当前状态为准；愿望与提案不等于已经交付的功能。新贡献优先按 [Dev 验收](docs/dev/TESTING.md)执行验证。

## 隐私和限制

- 用户关注和任务状态保存在当前浏览器 `localStorage`；清除站点数据或换设备会丢失，**单次 .ics 导出不能完整恢复任务状态**。没有跨设备同步。
- BYOK API Key 只保存在当前网页会话内存，不写入 `localStorage`、GitHub 或数据库。提供商会收到用户请求的内容；详见 [SECURITY.md](SECURITY.md)。
- 只读取无需登录的公开通知，不登录学校身份认证、不绕过 VPN/权限、不代填或提交申请。
- Vercel Hobby 用于个人/非商业原型；未来商业部署及用户账户、推送/私有订阅需重新评估成本、权限与隐私。

源码许可证：[MIT](LICENSE)。校方原始资料权利归各自所有者。
