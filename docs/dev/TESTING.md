# Campus Agent — 验收与复现

> Owner：Dev · 当前目标：浏览器个人申请任务 + 一次性日历导出

## 不依赖 AI 的本地检查

在仓库根目录执行：

~~~sh
node --check public/app.js
node --check public/taskboard-core.js
node --check public/taskboard.js
node --check api/chat.js
node --test tests/taskboard-core.test.cjs
git diff --check
~~~

预期：JS 语法全部成功、RFC5545 / 日期 / 任务验证单测全过、无 Git whitespace 错误。静态网站无需 Next.js 构建步骤。

## 实际浏览器回归

~~~sh
node tests/taskboard-browser.cjs
~~~

此脚本针对现有 Mac 开发环境的 Playwright 和 Chrome 路径编写；其他机器需根据本机安装位置适配。测试用本地 HTTP server，模拟合法官方数据，不在 GitHub 触发真实模型调用、日历写入或学校登录。

验收流程：
1. 默认通知列表中标题跳转浙江大学官方 URL；打开 Progress 后，尚未核对的日期只进入“线索”，不成为任务。
2. 核对并创建任务（测试用截止日 +2 天）：Progress 长条出现，今日看板显示“还剩2天”；完成状态手动改变。
3. 下载 `.ics` 后校验 UTF-8、换行、UTC/全天事件，Google 按钮只打开 TEMPLATE URL。
4. 刷新页面状态保持；在 390px 手机 viewport 无横向溢出，页面不抛 JS 异常。
5. 无 BYOK/后台数据库时任务界面仍可用。

近期一次本机测试记录：2026-11-19；单元测试 7/7；本地 Chrome smoke 测试任务创建、下载、完成状态、持久化与移动端均通过。**这不等于生产环境浏览器、iOS Calendar 导入、未来订阅端点已经验证。**

## 部署后真验收

- 检查 Vercel 项目是正确的 Hobby team、Vercel Auth 仍开启、目标 commit 与部署一致。
- 用 Vercel CLI 授权访问或账号本人直接打开站点。匿名访问预期重定向登录页。
- 读取 `https://raw.githubusercontent.com/mykcs/campus-agent-data/main/data/notices.json`，确认 `checked_at`、来源覆盖与健康状态。
- 检查 Vercel deployment list：因采集器数据更新而新增的 deployment 应为 0。
- 新版视图：导航、日期确认、Progress、今日看板、正常官网跳转、iPhone PWA 视口；不在未测试时声称真实远程 iPhone 已通过。
- 不调用真实 Kimi/Google OAuth/Apple 订阅就不能宣称相应连接成功；这些是独立验收项。

## 主要回归风险

| 失败情况 | 防护 / 证据 |
| --- | --- |
| 把报名开始日误作截止日 | `date_candidates` 不自动建任务；用户核对复选框 |
| SGT/PT 交界导致少一天 | `sgtToday` + 日期序号测试 |
| 今天任务已经完成仍显示逾期 | `done` 优先于日期警告 |
| 长中文 ICS 被截断或无法导入 | 按 RFC5545 折行（UTF-8 字节≤75），时间 UTC |
| 网站重构后 iPhone 横向溢出 | 390px Playwright width 检查 |
| 数据抓取失败却显示一切正常 | 来源状态、`checked_at`、错误展示 |
| 私人状态进入 GitHub | 任务只存在 localStorage；不要把浏览器导出文件提交 |
