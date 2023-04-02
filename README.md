# Furenzu_13
2023/3/25
1.建立bot
2.建立commandsAndResponses讓bot可回復訊息
3.推送至github並部屬到render.com
*建立Dockerfile檔案即可順利上傳render
2023/3/26
1.修改commandsAndResponses讓bot可隨機回復訊息
2.修改Dockfile
3.render中Environment Variables加入NODE_VERSION並填入版本號(18.15.0)
更:部屬是render後bot成功上線但於數分鐘內deploy faild，研判是需使用Background worker才順利進行。
2023/3/31
1.改部屬至樹梅派
2.取消Slash command，改為直接指令
3.新增responses.js，內含回覆內容
4.移除commandsAndResponses.js、Dockerfile
2023/4/2 
[1.2.0]
1.將回應功能移至messageHandler.js 移除responses.js
2.新增設置每日提醒dailyremind.js
3.新增設置定時提醒reminder.js
  使用方法 !rm <月> <日> <時> <分> <提醒事項>
  範例 !rm 4 2 10 20 天氣真好