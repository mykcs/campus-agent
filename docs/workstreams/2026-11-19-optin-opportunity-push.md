# 自愿订阅的机会提醒：退出网站仍收到通知 [Gated implementation candidate]

> Status: Draft · public-notice pilot implemented and tested locally · production delivery GATED
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

## 2026-11-24 implementation checkpoint

- Added a pure alert planner (`public/opportunity-alert-core.js`) and five regression tests. Explicit opt-in, fresh healthy snapshots, existing healthy source baseline and a durable deduplication ledger are mandatory. The planner only emits matched, newly discovered, dated official public URLs; it suppresses older backfill, newly onboarded sources, replay and untrusted URLs. It never sends, requests permissions, stores credentials or handles private deadlines. Conservative UTC-day screening can omit local-date boundary discoveries; this is not a complete publication-event stream.
- The website is still protected by Vercel Authentication. Listing existing Vercel storage integrations returned HTTP 403 in the current integration scope. No authorized private subscription store, independent student identity, authenticated sending scheduler or VAPID setup has been established. Do not create or expose a subscription database or change production protection to bypass this gate.
- Real iPhone/PWA closed-page delivery and opt-out delivery check: NOT RUN. Private deadline delivery: NOT IMPLEMENTED. A deterministic planner result is not a notification delivery receipt.
- Next: accept a free private storage/identity design and provision only with the relevant owner authorization, design authenticated dispatch with atomic event ledger and subscription revocation, then test explicit consent, one closed-page notification, replay and revocation on a consenting physical device. Keep this PR Draft until all delivery gates pass. No external alerts sent.

## 2026-11-24 · gated Web Push pilot implementation

### Implemented scope
- `lib/alerts-core.mjs`: invite-only enrollment, per-device hashed owner cookie, explicit opt-in preferences, 3-device/30-day pilot cap, healthy public snapshot and separate latest receipt validation, bounded metadata-only baselines and durable dedup ledger, atomic CAS claim and short dispatch lease, revoke and expired endpoint cleanup. No task dates, notes, student identity or BYOK keys enter the subscription registry. This is a bounded device-capability pilot, not an independent student account system.
- `lib/alerts-runtime.mjs`: private-only Vercel Blob adapter with ETag conditional writes, strict size limits, fixed official public GitHub data fetch (both catalog and health receipt), reviewed browser push-service host/path restrictions, mature `web-push` library for signed encrypted request construction, no redirects, bounded timeouts. Provider acceptance is not device receipt. Ambiguous attempts are not blindly retried; this can lose a notification on transport/worker failure. No real private Blob has been provisioned or exercised. Expired records are purged on subsequent successful mutations, not by an independent retention daemon.
- `api/alerts.js`: defaults disabled; needs every explicitly configured pilot environment variable in `.env.example`. Enrollment and dispatch secrets are separate; browser mutation requires exact same origin, dispatcher must authenticate and may not supply a notification destination or message. Existing Vercel Authentication must remain on. No automated dispatcher or authentication bypass was added.
- Follow settings contain an invite-only opt-in panel; no browser permission prompt until explicit enable action; user sees remote confirmation separately from permission. Service worker validates notification destinations against official school hosts, falling back to the app for invalid payloads. The only uploaded preference is the saved schools/departments/topics. Successful revoke blocks later dispatch claims; already accepted system-queued notifications may still arrive.
- Fixed planner school-local date handling and legacy ZJU AI explicit row dates; still suppresses backfill, undated/inferred publication dates, newly introduced sources and repeat notices. It is not a complete publication event stream. No personal deadline push or real account sync.

### Evidence (local, 2026-11-24)
- `npm run check`: 35/35 tests PASS, Astro 0 errors/warnings/hints, 2 HTML routes and Agent directory guards PASS. Includes 16 alert-specific tests (planner, server and worker): disabled mode, invite/origin/ownership, enrollment-dispatch-replay-revoke, concurrent claim, failed receipt, expiry, invalid endpoints/keys, real encryption with synthetic keys and intercepted transport, private CAS adapter, source date boundary, official click handling.
- `npm run test:browser`: 21 passed, 1 intentional WebKit offline skip. Both Chromium and WebKit simulated subscribe/revoke and no pre-consent prompts; 1440/440/390 CSS px; existing taskboard/ICS and Agent reader desktop/mobile smoke PASS. A selector ambiguity from the new button was corrected using the actual form submit selector. No physical iPhone or live browser push service contacted.
- Actual read-only public catalog/receipt: 113 notices, 10 sources, healthy, checked 2026-11-24T16:49:54Z; compact baseline contains no article bodies. The normal data refresh does not invoke Vercel deployments.
- `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`: zero known vulnerabilities after pinning the vulnerable transitive Zod dependency to 4.6.7 via scoped override; the initial mirror audit was unsupported, official registry identified the vulnerability and the repaired audit passed. This is not a security certification.

### Production gates and runbook
1. Obtain owner approval and establish a verified **private** Blob store for the existing protected project only after the actual provider plan, charges, budget and access are authorized. Do not assume Hobby; do not reuse a public Blob or put subscriptions in public GitHub. Prior integration listing returned 403. Do not expose tokens in commands, logs, repo or browser. Store/VAPID/invite/dispatch credentials must be configured through approved provider secret handling, never copied from test fixtures. Use the exact existing protected origin; leave `CAMPUS_ALERTS_ENABLED=false` until setup is verified.
2. Verify actual private store read/write/CAS and retention behavior with synthetic records in isolation. Verify deployment access, exact origin, VAPID key pair, push-host allowlist and secret-safe failure handling. The private Blob SDK supports conditional writes; Hobby free quota is bounded and exceeding quota can suspend access. Official references: https://vercel.com/docs/vercel-blob/private-storage ; https://vercel.com/docs/vercel-blob/usage-and-pricing ; https://vercel.com/docs/vercel-blob#conditional-writes .
3. Choose an authorized authenticated dispatch route compatible with protected Vercel access and free limits. No secret-bearing job or access bypass is authorized or enabled yet; no claim of 2-hour dispatch cadence. Current Vercel Hobby scheduler limitations and actual GitHub collection delays must be respected. Confirm explicit consent on a physical iPhone home-screen PWA (iOS 16.4+); https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ .
4. Verify one real notification with the page closed, original URL, no repeat, and revoke (no future send; already queued messages may arrive). No real sends were made in this candidate. Keep PR Draft until the live delivery gate is passed; personal deadline delivery remains separately gated by safe identity/storage and confirmed-task work.

### 2026-11-24 · live provider boundary and freshness integration
- Current authorized Vercel CLI `teams ls` readback identifies the existing team as **Pro**, not Hobby. The earlier Hobby assumption must not be used for provisioning. Official Blob pricing (https://vercel.com/docs/vercel-blob/usage-and-pricing) distinguishes Hobby limits from Pro included credit and on-demand charges. The user's approved scope is the free pilot; no paid store, plan change, billing commitment, credential or bypass was created.
- Previous exact candidate CI: https://github.com/mykcs/campus-agent/actions/runs/45445608014 — core and browser both passed. Current main includes #23's real PT/SGT timestamp UI; merged into this existing draft without changing the deployment protection or default-disabled push gate.
- **BLOCKED for live activation:** verified no-additional-charge private storage and scheduler, or separately authorized capped paid resources; approved private-store access; then consenting physical iPhone subscription/delivery/revoke. Prior integration listing returned HTTP 403, so no workaround or permission escalation is attempted. Keep draft; never claim real delivery from mocked transport. No new sends or subscriptions.
