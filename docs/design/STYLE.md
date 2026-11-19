# Design tokens — 清晰、轻量、可信

> 状态：active；实际样式以 `public/styles.css` 为唯一可执行真相。

## 视觉方向

参考 Linear Inbox 的信息密度与阅读焦点，参考 Readwise Reader 对待信息流的处理，不照搬炫技仪表盘。Anthropic 类浅色技术报告提供宽松留白、阅读友好对比；Campus Agent 仍需要实际可点击的任务控件，不做纯展示型网站。

- 背景：`#fff` / `#fbfcfa`；文字：`#252e29`；可信操作绿：`#28704c`。
- 次要文字使用稳重灰绿；风险提示用柔和暖色，不使用大面积彩色总结框。
- 标题以易读宋体/衬线为主，正文系统无衬线；层级由间距、字重、位置承载。
- 卡片边框薄、圆角小，Progress 横条优先可读和可比较，不显示不准确的百分比文案。
- 首页紧凑通知行；Progress 适度分组「今日看板 / 申请窗口 / 待核对」，避免所有项目同权重。
- 用 `textContent` 绘制学校外部文本，保持官方跳转链接可发现。

## 交互准则

- 一个公告行的主要链接永远是**学校官方原文**，AI 解读与跟踪是次要动作。
- 可选择的主题与学院是并集，用户不应因为选择奖学金而丢失其它已关注学院的全部通知。
- 筛选器和状态控件必须有可读文本及 `aria-label`，不能只靠绿/橙/红识别状态。
- 动画只辅助变化，不制造干扰；支持 `prefers-reduced-motion`。
- 表单先核对原文、再选择日期、最后明确确认；不为了减少一步而省略关键日期审阅。

## 体验回归

`node tests/taskboard-browser.cjs` 检查任务路径与 iPhone 390px viewport；部署前保留截图人工审阅。不要对未测试的真实 iOS Calendar UI 做完成声明。

## 2026-11-19｜从“首页乱”到读者任务优先（有边界的复盘）

用户在旧版 Campus Agent 首页看到大幅雷达装饰、4 张系统指标卡和默认空白的右侧详情区后说：“但是我现在看了你的首页，感觉有点乱。”随后明确补充：通知标题应该直达官方链接，并允许同时关注人工智能、计算机、软件学院以及额外的奖学金主题（原话在私有 .agents 的 `RAW-20261119-984 U001/U002`，此处仅保留简短引文）。

**旧反例**：把“抓到了多少条/多少附件”等机器指标与学生今天需处理的公告放在同一主视觉层；右侧没有选中通知时仍占面积。**已实施的校正**：2026-11-19 [PR #2](https://github.com/mykcs/campus-agent/pull/2) 将首页收敛成可搜索、可跟踪、可点原文的 Inbox；来源健康挪到“数据来源”视图；学院与主题以并集筛选。Progress 在 [PR #3](https://github.com/mykcs/campus-agent/pull/3) 作为另一有实际任务的工作页增加，没有让首页重新变成月历和仪表盘。

**下次相邻任务**：新增一个校园通知来源或申请功能时，先回答“用户今天最可能需要点击哪一条信息”；校验默认首屏有公开通知与官方直达，内部抓取指标退到来源页，次要 AI/跟踪操作不能取代官方原文主链接。当前 `tests/taskboard-browser.cjs` 是本地交互回归；通过 CI/浏览器仅证明功能与布局的机械性质，**不证明用户已最终接受视觉，尚无独立读者审美验收**。

**例外**：运维页面的首要任务本来就是系统健康，显示 KPI 卡片完全合理；本偏好只约束“学生第一入口/机会发现”类型的首页。此机制承接现有 [SHARED-DESIGN-001](https://github.com/mykcs/.agents/blob/main/docs/learning/shared/design/LEARNED_PREFERENCES.md#shared-design-001)、[003](https://github.com/mykcs/.agents/blob/main/docs/learning/shared/design/LEARNED_PREFERENCES.md#shared-design-003) 与 [007](https://github.com/mykcs/.agents/blob/main/docs/learning/shared/design/LEARNED_PREFERENCES.md#shared-design-007)，不另造通用设计规则或强制其他产品照搬 Linear 皮肤。
