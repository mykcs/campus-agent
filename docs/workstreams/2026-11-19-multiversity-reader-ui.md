# MIT / 清华 / 浙大多学校关注与安全官方跳转 [Implementation candidate]

> Status: Draft · UI candidate · browser and real-source acceptance pending
> Workstream: multisite-reader-ui · Size: M · Confidence: 中

## 目标及原因
用户可以像选择浙大学院一样选择 MIT、清华及它们的具体学院/部门；新信息出现后，通知标题直达各校官方原文，并按学生关注的学校 + 主题做并集，而不把 MIT/清华的未接入栏目伪装为已经监控。

## 来源与已有事实
- 来源：[Campus Agent 总索引](https://github.com/mykcs/campus-agent/issues/5)、[网站设计](https://github.com/mykcs/campus-agent/blob/main/docs/design/PROGRESS-UX.md)。
- 已有：`public/app.js` 的 `DEPARTMENTS` 和 `officialURL` 目前与 ZJU 域名/字段绑定，`public/taskboard.js` 对任务官方链接也仅允许 ZJU；前端只显示已有 ZJU 5 来源。
- 未证实：MIT/清华数据是否已稳定产出，未知时 UI 应继续显示「尚未接入 / 部分覆盖」。

## 范围
- 包含：school/department/source 的数据驱动选择器、跨校多主题关注、schema 迁移、各校官方链接安全校验、来源错误与 partial 反馈、时区/本地发布日期的明确显示。
- 不包含：新数据抓取器、学校账号登录、用户云端配置同步、改变 UI 样式体系为 Next/Astro/Tailwind 的无关重写。

## 规模、依赖与顺序
- M：改动 app.js、taskboard.js、UI、source contract 和浏览器测试；前端可用 MIT/清华 fixture 验证，线上可用数据发布依赖相应 data PR。
- 依赖：MIT 和清华 source adapter 的正式 schema；若只一校完成，另一校必须保留“待接入”而非假数据。
- 下一个动作：从 `public/app.js` 的 `DEPARTMENTS`、`TOPICS`、`officialURL`、`renderSources` 开始，写混合 MIT+Tsinghua+ZJU JSON fixture 的受限来源测试。

## 预计实施方案
1. 消费数据仓经过验证的学校/学院/source 元信息，提供清楚的学校选择；旧 `campus-agent:follows:v1` 偏好需升级保留，不删除用户已关注浙大学院。
2. 校验官方 URL 的 HTTPS/域名 allowlist 或基于可信源 registry 的安全关系，拒绝恶意 host、javascript:、重定向劫持和任意源 JSON 链接。
3. 在手机/电脑上验证学校、学院、跨校奖学金并集筛选，显示“partial / error / pending / ok”真实状态，并保持主链接直达官网。

## 验收（DoD）
- [ ] 给定三校合成真实结构的混合 JSON，关注 AI 学院+MIT 学院+跨校奖学金后，结果是去重并集；刷新仍保留已有浙大关注。
- [ ] 每条官方通知标题跳对应学校真实合法域名；非 allowlist 链接不开放，且不悄然跳到一个错误默认学校。
- [ ] 部分覆盖与未接入来源没有“已成功监控”标记；无来源时有正常空状态。
- [ ] 390px iPhone、桌面 Chromium 无横向溢出/脚本异常；当地日期/UTC差不被混淆为 SGT。
- [ ] GitHub CI / 本地测试 / 对实际新来源 JSON 读回全部通过；不触发模型或改变 Vercel 登录配置。
- [ ] 只有实际数据源验收后才能声称 MIT/清华已上线；否则仅 UI 合成验收。

## 安全、隐私、资源与恢复
无学校账号/私人数据/新付费能力。保留旧 Vercel 保护和私人 localStorage；迁移必须可回退，来源外链采用显式安全 allowlist。

## 证据与进度
- 规格审查：站点源码已观察到 ZJU 域名写死，真实三校浏览器端流程未实现。
- 实施：数据驱动学校/学院/来源目录，保留 v1 关注，学校/学院/主题并集；统一官网域名验证与无误跳转，旧 ZJU HTTP 公开链接保留；MIT/清华真实来源仍待数据 PR。
- 集成验收：候选分支待核心与 browser 验收；跨时区任务时间的确认/转换以及真实三校数据读取仍待完成。
- 最近核对：2026-11-19 PT；PR head 待读回。
