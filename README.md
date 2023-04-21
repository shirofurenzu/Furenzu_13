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

2023/4/4
[1.3.0]
1.messageHandler.js、dailyremind.js、reninder.js移至app資料夾
2.新增將發言紀錄到終端機功能
3.修正dailyremind筆誤
4.安裝axios
5.新增weatherTw.js
  使用方法:<縣市>天氣
  範例:台中天氣

2023/4/5
[1.4.0]
1.增加reminder.js提醒設置完成說明
2.暫停每日提醒dailyRemind.js
3.安裝node-cron
4.新增每日氣象功能dailyWeather.js

2023/4/7
[1.4.1]
1.修改dailyWeather.js輸出數據
2.修改WeatherTW.js輸入來源及輸出數據
F-C0032-001(原)>>F-D0047-091(新)
3.修改reminder觸發方式
!rm(原)>>rm(新)

2023/4/17
[1.5.0]
1.原回應和運勢功能分開為randomResponse和luck
2.改寫運勢功能
  使用方法:運勢 或 XXXX運勢
  範例:運勢 或 本日外出運勢
3.於messageHandler新增randomChoose功能
  使用方法:隨機 項目1 項目2 項目3
  範例:隨機 香蕉 芭樂 柳丁
4.於messageHandler新增randomNumber功能
  使用方法:隨機數字 數字1 數字2
  範例:隨機數字 10 999
5.簡化app.js中messageHandler及reminder呼叫子程式碼方式
6.randomResponse 增加骰子
7.新增以晴天表情符號☀️(discord:sunny:)呼叫天氣功能

2023/4/21
[1.5.1]
1.messageHandler新增🔢及🎲觸發，移除"骰子"觸發