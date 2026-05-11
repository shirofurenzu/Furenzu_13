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

2025/4/6
[1.6.0] 串接OPENAI API加入AI功能
1.新增gautoReplyWithGPT.js，可在gpt-4o-mini頻道問答
2.！重設 可重設上下文
3.！翻譯 可翻譯成中文
4.！風格 套用後可設定語氣風格
使用範例:
！風格 莎士比亞
我們該怎麼對抗命運？ → AI 用莎士比亞風格回答
5.！正常說話  清除風格，回到預設語氣
6.新增generateAndSendImage.js可在dall-e-3頻道文生圖
可指定風格或直圖/橫圖，預設為方形
使用範例:
一隻可愛柴犬坐在草地上 水彩風格 直圖
7.因應氣象署api變動，修改weatherTw.js和dailyWeather.js中最大/小舒適度指數寫法

2025/4/7
[1.6.1]
1.autoReplyWithGPT.js 新增切換模型功能，非預設模型時會顯示使用中模型
使用範例
！切換模型 gpt-4o  切換使用者 GPT 模型
！預設模型         移除使用者模型設定，改用預設模型
2.回覆時會自動刪除「思考中」字眼

2025/4/18
[1.6.2]
1.generateAndSendImage.js 將嵌入URL方式改為直接上傳圖片

2025/4/25
[1.6.3]
1.autoReplyWithGPT.js支援兩個指定頻道分別使用不同GPT模型
2.新增使用者可上傳圖片並提問，AI會針對圖片問題分析
3.改為斜線指令並以SlashManager.js管理
指令              說明
/風格 內容        設定你的對話風格（如：莎士比亞、客服、動漫角色等）
/正常風格         清除你目前設定的自訂風格，回復預設語氣
/翻譯 文字        將輸入的英文或其他語言翻譯成繁體中文
/切換模型 模型    換你目前使用的 GPT 模型（如 gpt-4o、gpt-4o-mini 等）
/預設模型         將你的模型切換回對應頻道的預設模型
/重設             重設與你之間的上下文對話紀錄

2025/4/30
[1.6.4]
1.reminder改成斜線指令，並可以在關機重啟後也能保留提醒功能

2025/5/24
[1.7.0]
1.於autoReplyWithGPT.js及generateAndSendImage.js新增Google Gemini api功能
2.新增2頻道供gemini及gemini image 使用
3.新增models.js，可用於切換模型，使用者不需手動輸入
4.autoReplyWithGPT.js新增回傳文字分段功能 以避免超過discord 2000字之限制

2025/5/31
[1.7.1]
1.修正gemini常回應錯誤問題。
2.autoReplyWithGPT.js翻譯功能預設語言由中文改為台灣繁體中文

2025/6/14
[1.7.2]
1.修正為切換模型和切換風格功能只在輸入指令得頻道觸發

2025/6/
[1.7.3]
1.autoReplyWithGPT.js的temperature設為1，以支援GPT-5
2.models.js加入gpt5系列及gemini-2.5-pro

2026/2/8
[1.7.4]
1.用 axios 來取代 node-fetch
2.將 'ready' 改為使用 Events.ClientReady
(app.js、dailyRemind.js、generateAndSendImage.js)

2026/2/9
[1.8.0]
1.重構dailyRemind及dailyWeather，
將ID設置移至.env，同時修改index.js
時間地點設置移至新增的dailyReminders和dailyWeatherTasks
配合dailyWeather修改app.js的每日氣象
2.每日提醒新增標記多人功能並改為使用 node-cron 來執行排程。

2026/2/10
[1.9.0]
1.新增每日提醒及每日天氣開關功能，可於.env設置
修改了index.js及app.js
2.優化dailyWeather並使用同一API網址
3.dailyRemind加入隨機抽選語句

2026/2/13
[1.10.0]
1.gemini圖片生成API改為付費，generateAndSendImage.js獨立使用付費gemini key

2026/2/14
[1.11.0]
1.新增gpt-image系列支援，並可以設定畫質
2.新增aiBotConfig.js，將模型設定由.env移動進去，models.js併入後移除
  變動autoReplyWithGPT、generateAndSendImage

2026/2/19
[1.12.0]
1.修改autoReplyWithGPT發生錯誤時提示方式，可顯示錯誤代碼及內容，同時微調generateAndSendImage
2.新增圖片切換模型功能，可在aiBotConfig.js加入
3.橫圖值圖邊長修改(1024×1536)
4.新增.env.example
5.微調每日天氣顯示方式

2026/2/20
[1.12.1]
將/切換模型及/切換回圖模型的參數分開

2026/2/27
[1.12.2]
aiBotConfig.js新增gemini-3.1-flash-image-preview模型

2026/3/4
[1.12.3]
aiBotConfig.js新增gemini-3.1-flash-lite-preview模型

2026/3/8
[1.12.4]
修正gemini角色問題以符合api規範

2026/3/12
[1.12.5]
修改README、新增CHANGELOG

2026/5/11
[1.13.0]
1.新增marketWatcher.js，可定時回報加密貨幣及美股
2.reminder.js 支援隔年提醒、修正較長時間提醒會報錯、新增刪除並合併提醒的斜線指令(一般、今日、刪除)
