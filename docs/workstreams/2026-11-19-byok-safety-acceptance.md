# BYOK 模型接入的安全验收与真实提供商兼容 [Task spec only]

> Status: Draft · TASK SPEC ONLY · Implementation: NOT DONE
> Workstream: byok-validation · Size: S/M · Confidence: 中高

## 目标及原因
学生能像 CC Switch 一样输入已支持的模型 API 地址、模型名和自己的 Key，得到带学校官方原文的答复；未配置或 provider 失败时仍有无模型检索。网站不依赖当前 ChatGPT 在后台持续运行。

## 来源与当前事实
- 来源：[Campus Agent 总索引](https://github.com/mykcs/campus-agent/issues/5) 与 [SECURITY](https://github.com/mykcs/campus-agent/blob/main/SECURITY.md)。
- 已有：`api/chat.js` 有固定 provider allowlist、单次 bearer 代理与 23 秒 timeout；`public/app.js` 允许 Kimi / DeepSeek / OpenAI 及自定义 CORS 直连，Key 保存在本次页面内存；没有真实付费 provider E2E 收据。
- 未证实：Kimi 和其他 provider 在当前 URL/模型 ID 的真实有效性、限流/多用户恶意调用下的资源边界，以及用户实际费用；不得凭按钮存在声明“兼容”。

## 范围
- 包含：可复现的服务端 Mock Provider 测试、非法/本地 IP/重定向 URL 与密钥泄漏负例、常见 401/402/403/429/5xx/超时/CORS 用户提示、官方引用约束；用户可选用自己的 Key 做**一次明确授权**的低成本真实单轮验收。
- 不包含：收费模型代付、集中多用户 Key 托管、供应商账号新注册、无授权复制/读取用户已有真实 Key、改造为大型通用 Agent 框架。

## 规模、依赖与顺序
- S/M：一条独立入口 `api/chat.js`、表单/错误处理和测试，Mock 第一阶段可先合并；现实 provider 验收依赖用户选择并授权其真实 Key。
- 依赖：无；并行于数据来源扩展。后续多学校检索可以复用已验证的 ask 接口。
- 下一个动作：以 `api/chat.js` 为被测对象，建立不含真实密钥的 Node request/response Mock 及 mock `fetch`，先测试允许列表和阻止敏感主机。

## 预计实施方案
1. 只使用假 Key 验证200合法响应、空响应、超时、429/401、注入式通知正文与 server-side URL 拒绝；测试中 assert 错误内容无 Key、日志无 Key。
2. 检查前端 provider 状态/费用提示、失败回退到官方链接、Key 清空和关闭页面后的行为；确认浏览器直连的 CORS 限制。
3. 如用户明确授权自己的真实 Key，用最低 token 进行一次 provider smoke 测试，记录 HTTP/模型/来源链接与费用界限，**不记 Key**；没有该授权就保留 NOT RUN。

## 验收（DoD）
- [ ] 自动化 Mock 测试覆盖 POST/405、跨域来源、payload size、恶意 Base URL、凭据格式、典型 provider HTTP 错误、无响应和 timeout。
- [ ] 输出/日志/CI/浏览器 localStorage 不泄露任何测试/真实 Key，负例可复现。
- [ ] 无模型时搜索正常，模型回答不确定/无来源时显示来源缺口且仍可打开学校官网。
- [ ] 用户所选真实 Kimi/其他 provider 的 API 回执与普通浏览器体验 **只有被执行才标 PASS**；未授权真实测试注明 NOT RUN。
- [ ] GitHub CI 和本地回归通过，不要求每次 PR 调用收费 API。

## 安全、隐私、资源与恢复
禁止在公共 PR、工单、测试 fixtures、打印输出或 URL 记录 Key；不借助 Cloudflare，不扩大代理到任意服务器内网。任何实际收费调用需使用用户明确授权的账户与预算；无授权只完成 Mock 验收。

## 证据与进度
- 规格审查：依据现有后端与前端调用路径；真实 provider E2E 尚无证据。
- 实施：NOT DONE
- 集成验收：NOT RUN
- 最近核对：2026-11-19 PT；head 以 PR 为准。
