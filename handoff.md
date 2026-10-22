# 看图小侦探 · 交接

## ⏯️ 做到哪
v1.0 已上线（2026-10-08）：https://tahun1-bc-kantu.vercel.app ，Hub 已登记，check 全过。

## 🚦 状态
- 两种用法：「开始破案」随机 6 题（电脑室）；「自己选题」24 题网格（一体机）。题库 `bank.json` 老师 10-08 逐题确认；图在 `scenes/*.jpg`（原图 `~/Downloads/场景裁切/`）。

## ➡️ 下一步
1. 课堂实测，有意见登记进 tools-status.json 与 published-tools-coverage.md 优化备注。
2. 多音字待老师耳听确认：种树（zhòng）、背着书包（bēi）、空闲时／空地上（kòng）、傍晚（bàng）。
3. 改版照 teaching-tools/agents.md「改版同步五步」；部署由老师用 `!` 跑 `vercel deploy`（命令见 agents.md）。

## ⚠️ 坑
- 本机测试：`python3 -m http.server 8941`，开 http://localhost:8941/index.html（bank.json 用 fetch，不能双击开档）。
- 改题前先读 `agents.md` 关键决定（干扰项原则、老师钦定的句子）。

## 🕐 最后更新
2026-10-22，Claude Sonnet @ 瘦身整理 · Git：见 git log（预期已推）
