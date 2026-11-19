# 自愿订阅的机会提醒：退出网站仍收到通知 [Task spec only]

> Status: Draft · TASK SPEC ONLY · Implementation: NOT DONE
> Workstream: opt-in-opportunity-alerting · Size: L（分阶段交付） · Confidence: 低

## 目标及原因
用户最初的痛点是**不知道某项奖学金公告存在就错过申请**。需要对用户自愿关注的学院和主题，在新公开公告发布后主动提醒，即使当时没有打开网站；对学生**已确认**的申请任务，再提供截止前的个人提醒。

## 来源与已有事实
- 来源：[Campus Agent 总索引](https://github.com/mykcs/campus-agent/issues/5)、[PRODUCT-WISHES](https://github.com/mykcs/campus-agent/blob/main/docs/wish/PRODUCT-WISHES.md)、[任务状态模型](https://github.com/mykcs/campus-agent/blob/main/docs/dev/TASK-STATE-AND-ICS.md)。
- 已有：前端关注只在本浏览器 localStorage；任务也仅在 localStorage；`public/sw.js` 目前只有离线 shell，不含 Push subscription 和消息显示逻辑；数据仓有两小时 GitHub Actions 采集但可能延迟。
- 现状限制：Vercel 生产访问受 Vercel Authentication 保护，**不等于有面向学生的独立身份系统**。Apple iOS 16.4+ 需将 PWA 加入主屏幕，通知权限必须由用户动作触发；推送需要安全服务端存储订阅：https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Vercel Hobby 的 Cron 调度频率/精度限制与每月配额需在实现时按当前官方文档验证，不将 Vercel 视为免运维实时推送服务：https://vercel.com/i/event-driven-architecture

## 范围
- 包含：小范围可撤销的 opt-in 方案选择、订阅与注销生命周期、最小订阅数据存储、公开新公告的去重/幂等消息、追踪送达失败、支持 iOS 主屏幕 PWA，及在权限拒绝时的可理解降级。
- 包含第二阶段：个人申请到期提醒仅针对用户明确确认的截止日期；如无法安全持久化个人数据，先明确阻碍，不伪造后台提醒。
- 不包含：全校无遗漏保证、未授权群发/邮件、默认启用通知、修改现有 Vercel 登录保护、偷存用户 API Key、商业付费推送服务或自动申请材料提交。

## 规模、依赖与顺序
- L：涉及身份/授权、敏感订阅地址、安全持久化、调度与真实 iPhone 验收，含产品决策和成本门槛。
- 前置：数据仓的来源健康工作线需要给出可辨的「新增/失效」事件语义；用户身份和推送数据持久化方案未获验证，不应直接发布。
- 下一个动作：用独立无真人资料的匿名测试 PWA + mock 推送验证 iOS 能力/SSO 兼容性；列出现有 Vercel 免费能力与不允许的成本，形成可证伪方案对比再实现最小 MVP。

## 预计实施方案
1. **Phase A｜技术与成本可行性**：Apple Push API/Service Worker 原生要求；确认公开 Vercel 访问保护不被破坏，是否需要新的匿名测试站点或用户独立身份，并明确用户授权/费用选择。
2. **Phase B｜只针对公开新通知的提醒**：提供学校/主题选择、实际订阅/撤销、匹配去重、错误码/expired subscription 清理；任何公开数据更新不触发 Vercel 重建。
3. **Phase C｜私人到期提醒**：若隐私与存储授权满足，再保存必要的已确认任务日期；完成任务不应继续提醒。
4. **Phase D｜真实设备**：在同意的 iPhone PWA 上做一次关网页、消息到达/撤销后不达、重复采集不重复发的证据测试。

## 验收（DoD）
- [ ] 与现有 Vercel Auth 的访问控制兼容性和 Hobby 实际费用被验证；不需要付费/禁用保护才能工作，若需要，停止并列明 blocker。
- [ ] iOS 16.4+ 的主屏幕安装、用户主动允许通知及服务端订阅成功，不在未授权浏览器弹出权限；拒绝/撤销均可继续使用网站。
- [ ] 给定公开新公告和用户关注匹配，用户关闭页面后收到一条可点击的官方原文通知；重复抓取至多一条，取消订阅后不再发送。
- [ ] 仅已核实的个人截止日期可进入个人提醒；任务完成/更改日期状态能及时取消/更新提醒；若未实现明确降级。
- [ ] 可查错误/延迟与独立抓取失败；不声称 100% 到达或“最迟 X 小时”除非有连续测量证据。
- [ ] 所有 subscriptions/token/private profile 永远不入公开 GitHub、页面 URL 或日志；权限失败的安全负例测试；成本不超用户已接受的免费边界。

## 安全、隐私、资源与恢复
不在当前用户手机/Apple Calendar/生产推送上做未经用户确认的真实订阅测试。不使用 Cloudflare；不禁用 Vercel Auth；新增存储、密钥或外部第三方推送必须先完成权限与隐私审查。仅建任务规格时不部署。

## 证据与进度
- 规格审查：依据源码、Apple 官方 Web Push 文档；**实际真机通知未运行**。
- 实施：NOT DONE
- 集成验收：NOT RUN
- 最近核对：2026-11-19 PT；head 以 GitHub PR 为准。
