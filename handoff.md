# 看图小侦探 · 交接

## ⏯️ 目前做到哪
v1.0 已上线（2026-10-08）：https://tahun1-bc-kantu.vercel.app ，Hub 已登记（kongsi-idea 9b2285b），`npm run check -- tahun1-bc-kantu` 全部通过。

## 🚦 目前状态
- 玩法：看图 → 把线索卡拖进「时间，人物在地点做什么。」→ 检查。错格摇动＋「X不对」标签＋语音提示，1.1 秒后错卡回池；对格锁定。星星：0 错 3 星／1 错 2 星／≥2 错 1 星。
- 两关：第一关卡片按要素分色；第二关卡片无色，放错要素格判「放错格子」。
- 两种用法：「开始破案」随机 6 题（电脑室）；「自己选题」24 题网格（一体机全班）。
- 题库：`bank.json`（每格 [都算对, 干扰项]），2026-10-08 老师逐题确认。图片来源：老师提供 `~/Downloads/场景裁切/01–24.png`，转成 `scenes/*.jpg`。
- 朗读：edge-tts `zh-CN-XiaoxiaoNeural` -10%，`gen-voice.py` 读 bank.json＋say.json 生成全部卡片词、提示语、每题所有正确组合整句（197 句）。改题库后必须重跑。
- 视觉：侦探笔记本（深蓝办公桌＋左上台灯、证物照片夹、活页笔记本、黄铜检查按钮、红色「破案！」章）。四要素色：时间琥珀 `#F4A62A`／人物玫瑰 `#E45F7B`／地点青绿 `#22A398`／做什么紫 `#7A68E0`。字体 ZCOOL XiaoWei（标题）＋ Noto Sans SC（卡片）＋ Baloo 2（数字）。
- 课本出处：一年级课本教师提示（全文提取第 1854 行）要求讲述交代时间、地点、人物；无专门单元。
- DSKP 对照：待补（只写本机官方 PDF 核对过的代码）

## ➡️ 下一步
1. 课堂实测，有意见登记进 tools-status.json 与 published-tools-coverage.md 优化备注。
2. 多音字待老师耳听确认：种树（zhòng）、背着书包（bēi）、空闲时／空地上（kòng）、傍晚（bàng）。
3. 改版：照 teaching-tools/agents.md「改版同步五步」；部署命令 `vercel deploy --prod --yes --scope kongsi-idea` 由老师用 `!` 跑。

## ⚠️ 注意事项
- 本机测试：`python3 -m http.server 8941`，开 http://localhost:8941/index.html（bank.json 用 fetch 读，不能直接双击开档）。
- 干扰项原则：一定要「图里看得出明显不对」；时间多半看不出来，所以时间格常有多个都算对。改题时守住这条。

## 🕐 最后更新
2026-10-08
