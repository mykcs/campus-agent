# Deadline Task 数据合同与 iCalendar 导出

> 状态：active（本地 MVP）
>
> Owner：Dev
>
> API owner：`public/taskboard-core.js` + `public/taskboard.js`

## 概念与生命周期

`Notice` 来自大学公开索引：`id, title, url, published_at, department_id, date_candidates` 与可选 `date_events`。它**不是**待办。自动抽取的日期只进“发现的日期线索”，带 `verified:false`。优先消费同一官方 URL 的类型化事件；保留同日不同角色与申请范围。未解析日期、开始日和未知类型不预填截止日。旧版 date_candidates 仍兼容。

`DeadlineTask` 由用户点击“从通知创建”并阅读官方来源后生成：

```json
{
  "id": "task_<uuid>",
  "noticeId": "<source notice id>",
  "title": "<official notice title>",
  "officialUrl": "https://ai.zju.edu.cn/...",
  "sourceId": "zju-ai-admissions",
  "publishedAt": "2026-10-20",
  "deadlineDate": "2026-11-20",
  "deadlineTime": "20:00",
  "deadlineTimezone": "Asia/Singapore",
  "notes": "确认针对哪类博士申请",
  "status": "todo",
  "createdAt": "<ISO UTC>",
  "confirmedAt": "<ISO UTC>",
  "completedAt": null
}
```

`deadlineTime` 可为空，此时日历导出为全天事件，并不等价于午夜截止。用户可以对同一公告的不同申请流程建立多个本地任务。

## 状态与显示

| 存储状态 | UI | 自动变更？ |
| --- | --- | --- |
| `todo` | 未开始 | 只有用户可改 |
| `doing` | 进行中 | 只有用户可改 |
| `done` | 已完成 | 只有用户可改，记录 `completedAt` |
| 剩余天数 ＜ 0 且非 done | 已逾期 N 天 | 由日期计算，**不代表申请失败** |
| 剩余天数 = 0 且非 done | 今天截止 | 由日期计算 |
| 剩余天数 ＞ 0 且非 done | 还剩 N 天 | 由日期计算 |

日期差采用用户确认的截止时区日历日，而不是浏览器本地午夜；旧任务缺少 `deadlineTimezone` 时仍采用 SGT。支持 SGT、美东、美西、UTC 及明确 UTC 偏移。未明确时区需选择；夏令时重复或不存在的本地时刻必须核对明确偏移后才允许保存。当天明确时刻已经过去则标记已到截止时间；日期任务不猜测午夜。进度条按 `publishedAt → deadlineDate` 的 **时间经过比例** 绘制，绝不表示任务工作完成百分比。对于候选日期不绘制已确认任务条。

“今日看板”包含 7 天内未完成、逾期和手动标记进行中的事项；完成状态留在 Progress 列表。日期变化按用户打开/刷新时重新计算；本地存储不是后台推送服务。

## 存储与迁移

`localStorage["campus-agent:tasks:v1"]` 是唯一任务状态 owner；不得在公开通知 JSON、Vercel 部署日志、GitHub CI 或 BYOK API 中存个人任务。当前无账号、跨设备同步和自动备份。未来如引入账户/数据库，先做最小权限、隐私评估、导入导出格式和用户明确授权。

## .ics / Google Calendar

- `download .ics`：在当前浏览器生成所有**已核对**任务的 RFC5545 `VEVENT`，`UID` 稳定，`DTSTAMP`、`SUMMARY`、`DESCRIPTION` 和官网 URL 保留。
- 全天事件 `DTSTART;VALUE=DATE` 起始日期含当日，`DTEND;VALUE=DATE` 为**次日（排他）**；确认了小时则按所确认时区转成 UTC `YYYYMMDDTHHMMSSZ`；Google 模板使用相同 UTC 时间。
- 完成状态不作为外部可双向更新的待办；导出只发生一次，之后网站修改日期不会自动更新已导入事件。重复导入也可能产生重复日程，具体以日历客户端为准。
- Google 按钮打开 Google Calendar 的 TEMPLATE 链接，仍需用户主动保存；不是 OAuth 长期连接。
- Apple Calendar 官方支持订阅 **只读** `.ics` URL，但当前网站部署受 Vercel Authentication 保护，且个人任务只存在浏览器中，因此**不存在可供 Apple 自动拉取的私人订阅 URL**。

## 未来候选设计（尚未上线）

真正跨设备订阅需要：用户独立账户、权限控制的任务数据库、可撤销的私人高熵读令牌、公开可访问但令牌鉴权的 `text/calendar` endpoint、到期/撤销机制、iOS/Google 实测刷新与延迟告警。令牌一旦作为 URL 进入日历，必须当作敏感凭据；不能把学生的任务放进公开 GitHub 或暴露无鉴权订阅。

外部日历读回 completion 是另一套 OAuth/CalDAV 集成，成本明显高于只读订阅，不属于目前承诺。

测试依赖：`tests/taskboard-core.test.cjs`、`tests/taskboard-browser.cjs`。

`evidenceKey/evidenceRole/evidenceScope` 为本地线索关联，不是校方核实结果；同一通知同日不同角色可分别建立任务。无公告日期时明确展示开始跟踪日，不伪造发布时间。已有 `tasks:v1` 不重写。

## Local portable backup (WP13/A13)

`campus-agent-local-backup` version 1 is a private user-owned JSON file containing only validated follows and task fields (legacy implicit SGT and explicit deadlineTimezone/evidence preserved). It is not an ICS file, user account or continuous sync. Unknown fields, untrusted school URLs, invalid task dates/IDs, duplicate IDs, over-limit records/files and unsupported versions fail closed. Export reads only the two task/follow keys, never model state/credentials. Import previews before consent: default merge keeps existing conflicting IDs, unions follows, and adds new tasks; explicit replacement discloses deletion and requires confirmation. Before write, compare the actual two localStorage values to preview; attempt rollback on partial write and state uncertainty explicitly. This is a browser-local operation, not a cross-tab distributed atomic transaction. The file may contain personal notes: keep it private. No network upload.
