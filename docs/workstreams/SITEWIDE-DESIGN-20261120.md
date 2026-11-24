# Campus Agent 全站排版与年月日执行合同

维护者2026年11月20日要求所有网页真实消费本站标准。代码 owner 为 `public/styles.css` 与 `public/display-date.js`；长期规则见 `docs/design/STYLE.md`。跨仓库保留独立设计。

## 实施

所有普通字体/字号/字重/行高、243个间距值与阅读/弹窗宽度已迁移至有限语义尺度，标题保持宋体、正文保持系统无衬线，通知和任务控件小字提高至12/14px。唯一HTML及其4个视图、今日看板和3个对话框共用此owner；service worker新版shell包含显示函数，离线页面同样引用。

日期公共边界被通知、检查时间、申请窗口和候选线索调用；完整中文日期年月日，部分日期不填造。瞬时信息保留SGT(UTC+8)和跨年边界；机器日期、未经核实线索与用户确认截止日仍分开。taskboard-core.js、api/chat.js、Vercel CSP/鉴权与外部采集仓不变。

## 必须通过的交付标准

- 全部 public HTML 自动枚举且实际 stylesheet/body/spacing消费者被检查；添加孤立页面或 raw calc/混合负数样式会失败。
- 原7个日期/任务/ICS单测与新2组显示精度/负例全部通过。
- 两引擎×1440/440/390px全视图与对话框，无页面横向溢出或可见文字意外裁切；扰动字体、字号、行距、间距与宽度，真实消费者改变且恢复，宽度必须实际几何改变。
- 任务创建仍需明确核对；Today只含已确认任务；状态手动改变且刷新持久化；旧ICS与Google一次性模板smoke保留。
- 当前head CI通过、人工看截图后Ready并合并main，读回merge SHA；Vercel protected production身份另外核对，不把代码合并当已上线。

## 本地证据及尚待执行

`npm run check` PASS（9个测试；1 HTML及全部源owner/日期消费者检查）；`git diff --check` PASS。Playwright 6个全流程案例（每例全部视图）与原浏览器smoke已接现有checks.yml。云执行器不提供可运行Chromium，本地不宣称browser PASS；须以候选正式CI结果和截图收束。原数据/核心任务运算字节比对保留。

回退为本PR逆向改动；实现、测试、合并与既有部署权限沿用本任务授权。
