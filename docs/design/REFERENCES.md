# 成熟产品参考与适用边界

> Owner：Design · 最后核对：2026-11-19

| 参考产品 | 已有强项 | Campus Agent 吸收的方法 | 不能直接照搬 |
| --- | --- | --- | --- |
| [Linear](https://linear.app/docs/projects) | 状态、目标日期、进度透明度 | 任务与完成状态独立于时间窗口 | 面向软件项目的复杂团队结构 |
| [Notion Timeline](https://www.notion.com/help/timelines) | 跨多日的长条时间轴 | 公告发布到个人截止的直观时间跨度 | 不要求每个学生开 Notion 账号 |
| [Notion Calendar](https://www.notion.com/help/use-notion-calendar-with-notion) | Notion 数据库条目状态与日期编辑 | 借鉴已有任务数据模型和状态分离 | 不能假定 Notion DB 可直接在 Apple/Google 日历显示 |
| [Apple Calendar](https://support.apple.com/guide/iphone/use-multiple-calendars-iph3d1110d4/27/ios/27) | iPhone 端只读 `.ics` 订阅 | 作为将来可选的提醒/可视化承载 | 无法直接反向修改 Campus Agent 任务完成状态 |
| [Google Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) | 跨平台日历、授权写入事件 | 初期先一键创建单个预填事件 | 实际 OAuth token 管理、更新和撤销有独立成本 |
| [RFC5545](https://www.rfc-editor.org/rfc/rfc5545) | 标准事件 / 待办语法 | 验证 DTSTART、排他 DTEND、UTF-8 折行 | VEVENT 不自动等于用户任务完成状态 |

**选择理由**：学校通知发现、真假审核与完成状态是 Campus Agent 的独特价值，必须在站内保留；公开标准的日历事件可以由成熟 App 代为显示。后续只有在有明确用户收益和稳定权限方案时才增加独立日历 API 或订阅服务。

设计参考不是「当前产品已经具备这些功能」的证据。外部软件和 API 的行为以各自官方现行文档为准。
