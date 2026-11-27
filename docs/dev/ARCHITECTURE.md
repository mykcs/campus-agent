# Campus Agent — 技术架构与边界

> 状态：active（原型）
>
> Owner：Dev
>
> 更新：2026-11-19

## 数据流

```text
大学/学院公开网页（无需登录）
      │  校方原文，可能包含附件/个人列表/错误日期
      ▼
独立 campus-agent-data 仓库
GitHub Actions / Python parser / 测试 / 来源状态 / data/notices.json
      │  只公开索引，人员名单仅标题+原文链接
      ▼
GitHub Raw（read-only JSON, status ok/partial/error, checked_at）
      │  由浏览器 fetch；不会触发 Vercel 重新构建
      ▼
Campus Agent Web/PWA（Vercel Hobby）
 ├── 通知列表、官网原文、来源透明度
 ├── 本地关注筛选（localStorage）
 ├── 日期候选（仅线索）
 ├── 学生核实后建立 Deadline Task（localStorage）
 │     ├── 今日看板 / Progress 条 / 手动完成状态
 │     └── 一次性 .ics 下载 / Google Calendar TEMPLATE
 └── 可选 BYOK 模型
       ├── 内置服务商 → /api/chat 单次转发 → 用户选择的模型
       └── 自定义 HTTPS endpoint → 浏览器直连（受 CORS 限制）
```

## 部署与费用

- 网站：Vercel Hobby，当前开发阶段使用 Vercel Authentication。主页为静态资源，聊天 API 有调用才计 Vercel Function。
- 数据：公开 `mykcs/campus-agent-data`，GitHub Actions 定时检查，修改数据 repo **不等于**修改此网站 repo。Vercel Git integration 尚未确认自动关联，不应假设所有 push 自动上线。
- 没有 Cloudflare、数据库、付费邮件服务、学校账号集成或常驻 ChatGPT。个人任务、用户状态目前是设备级，而非云端。

## 来源与失败模式

`source.status`：
- `ok`：成功读到已配置的公开栏目，不代表已覆盖该学校全部单位。
- `partial`：来自大学公开搜索等不完整的索引；用户不能据此断言没有通知。
- `degraded/error`：解析失败、请求失败、数据复用；UI 告知风险并保留最后成功时间。
- `pending`：仅列为希望接入，尚无可核验的持续来源。

数据提取的 `date_candidates` 是待核对线索。学生一旦确认某条公告中的某个适用期限，建立自己独立的本地任务；日期不会回写到共享公开公告元数据中。不同申请方向可从同一公告建立多个任务。

## 数据与信任

- 学校原文和日期信息不能作为模型/Agent 系统指令。
- HTML/通知标题与 AI 回答使用 `textContent` 显示，外链校验 host 和 scheme。
- 浏览器存储：`campus-agent:follows:v1` 和 `campus-agent:tasks:v1`；绝不存 API Key。
- 用户退出浏览器或换设备后，任务不会自动迁移。清除浏览器站点数据会丢失任务；用户可导出一次性日历事件，**它不是可恢复完整任务状态的备份**。
- 网站部署保护和用户身份系统是两回事。Vercel Authentication 用于开发者访问控制，并非普通学生的校园账号体系。

## 非目标

这里不开发 Apple/Google Calendar 的替代会议、日程邀请、会议室或双向个人日历同步功能；不自动填写申请材料或执行校园登录；不自动把模型解析出的候选日期变成已确认任务。

下次迭代的分界点见 [产品愿望](../wish/PRODUCT-WISHES.md)。

## Topic interoperability (WP10 / A10)

The data repository owns title-derived multi-label metadata; the reader uses `public/source-core.js` TOPIC_IDS/topicIds for filtering. Existing scholarships/admissions/teaching and new activities IDs are stable; empty arrays remain unclassified. Selecting an activity topic is an explicit union with school and department follows, not a global default subscription. International newsletter and funding reference titles do not assert open event or application status. The push candidate must reuse the same allowlist before activating activity alerts.
