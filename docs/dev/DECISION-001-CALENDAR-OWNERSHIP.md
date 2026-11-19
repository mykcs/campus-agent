# ADR-001 — 进度管理留在 Campus Agent，日历外包

> 状态：accepted（2026-11-19）
>
> Owner：Dev / Design
>
> 背景：用户希望看到从公告公布直到截止的一条 Progress 长条，今日看板可标记完成或未完成，并能看到剩余天数；同时希望优先复用成熟软件、尽可能免费、不把网站做成庞大的日历产品。

## 方案比较

| 方案 | 已有成熟能力 | 最关键缺口 | 决策 |
| --- | --- | --- | --- |
| Campus Agent 全量日历 | 公开数据与个人任务可同处一站 | 需要重建提醒、时区、日历 UI、同步、跨设备权限 | 不做通用日历 |
| Campus Agent Progress + Apple Calendar | 站内任务权威，Apple 接受只读 `.ics` 订阅 | 订阅只读、刷新频率不由网站控制，开发期受 Vercel SSO 阻断 | **采用分层**；先一次性导出 |
| Campus Agent Progress + Google Calendar | Google 支持多设备、日历 API | 需 OAuth 授权与正确 token 生命周期；Calendar Event 不是可回传的任务状态 | **采用分层**；先模板添加 |
| Notion Timeline + Notion Calendar | 现成 Timeline 横条、数据库状态，Notion Calendar 可编辑部分数据库属性 | 要让普通学生开设/授权 Notion，仍需校园公告归属/接口；Notion 数据库事件不能直接出现在 Apple/Google 日历 | 可选高级集成，暂不强制 |
| 完全放弃站内任务，委托日历 | 少写代码 | 无法可靠判断个人是否已申请完成、重复或已错过 | 拒绝 |

## 依据

- [Apple Support: subscribed calendars are read-only](https://support.apple.com/guide/iphone/use-multiple-calendars-iph3d1110d4/27/ios/27)。
- [Google Calendar Events.insert: requires OAuth](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)。
- [Notion Timeline: date ranges and progress](https://www.notion.com/help/timelines)。
- [Notion Calendar + Notion database properties/status](https://www.notion.com/help/use-notion-calendar-with-notion)。
- [RFC5545: VEVENT and VTODO / STATUS are distinct semantics](https://www.rfc-editor.org/rfc/rfc5545)。

这些文档说明了能力边界；尚未独立验证 Apple/Google 对本项目未来远程订阅的刷新频率、token 失效和去重表现，不能作出保证。

## 已采纳架构

- **站内事实层**：学校官网来源、`date_candidates`、核对标记。
- **个人任务层**：用户主动确认 `deadlineDate`，在本地维护状态、今日看板、Progress。
- **外部日历层**：只输出确认过的截止日，使用 `.ics` 一次性下载或 Google TEMPLATE。长远再评估只读订阅；双向状态同步不是首要目标。
- **零模型依赖**：日期计算、进度条、日历导出均是确定性程序，运行时不调用 Kimi/ChatGPT，不引入按通知数量线性增长的模型费用。

## 为什么目前不做“自动订阅链接”

用户已选择 Vercel Hobby 并开启 Vercel Authentication 保护网站。Apple/Google 作为独立客户端，无法自然使用登录到 Vercel 控制台的网页会话；而任务数据仅在用户浏览器内，没有服务端可供日历客户端定时拉取的私有数据源。提供一个假的 `webcal://` 地址会造成错误承诺。未来需先明确安全的用户身份及私有订阅方案。

## 重新评估的触发条件

出现真实需求：用户希望跨设备自动刷新已确认截止日期、用户愿意承担安全凭证和后台存储的成本、已核验原生日历兼容性与 API 授权后，再提交独立 ADR；不可无声扩大本阶段部署权限或付费范围。
