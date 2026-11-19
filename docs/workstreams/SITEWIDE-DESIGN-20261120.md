# Campus Agent 全站排版与年月日统一

> Draft · TASK SPEC ONLY · Implementation: NOT DONE
> Size: M · Confidence: medium

## 目标与来源

2026年11月20日维护者要求本站所有网页实际消费统一字体、字号、字重、行距、间距与年月日标准；各网站独立保留风格。实现、验收和合并 main 全部完成才交付。

## 事实与唯一归属

已有 public/styles.css 颜色 owner，但文字/间距尚硬编码；formatDay 使用点号，sgt 缺年份，taskboard 自行替换。#6/#7/#8 仅任务规格；#7 后续 UI 必须消费本工作线 owner。

public/styles.css 的语义 tokens；docs/design/STYLE.md 真实规则；公共日历日期/时间显示能力与 app.js/taskboard.js 调用方。

## 实施和验收

- [ ] 全站共用一个语义 typography/spacing owner；重复活动定义真正迁移，必要例外按正文/图表/代码/演示/打印等角色记录。
- [ ] 真实 build 或路由清单覆盖每个页面/视图；不仅查链接存在，还检查生效字体、字号和间距。新增漏接页面必须使检查失败。
- [ ] 完整日期按年月日：中文 YYYY年M月D日，英文 YYYY-MM-DD；仅年/月精度不得补造；timestamp 带明确时区。机器字段/URL/代码/证据保持原样。
- [ ] 保留 user-confirmed deadlines、SGT 日期边界、ICS exclusive end、浏览器本地完成状态和 BYOK 边界；不改数据采集仓，不关闭 Vercel Authentication。
- [ ] node --test tests/taskboard-core.test.cjs；改动 JS syntax checks；现有 browser smoke 适配云端并覆盖 feed/sources/chat/Progress/Today/对话框，桌面与440×956无溢出。
- [ ] 现有功能/隐私/科学门禁保持有效；加入漏接样式/非标准日期负例；当前候选证据通过后 Ready 并合并 main，读回 SHA。
- [ ] 发布状态和源码合并分别核实，不拿 PR 创建或 provider READY 代替页面验收。

## 执行与恢复

单一写入者，按总优先级逐站推进；已获实现、验证和合并授权。保留本站 provider 与访问保护。下一步读取真实 source owner、依赖和生成输出。回退为本 PR 的逆向变更。

## 证据

仅合同已创建；实现 NOT DONE；构建/浏览器 NOT RUN。实施完成后补命令、结果、覆盖数及真实证据链接。
