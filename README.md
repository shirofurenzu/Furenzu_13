# 🦊 Furenzu_13：全方位 AI 智慧服務機器人

![Node.js](https://img.shields.io/badge/Node.js-v18.15.0+-green.svg) ![Discord.js](https://img.shields.io/badge/Discord.js-v14.25+-blue.svg) ![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Furenzu_13** 是一款專為 Discord 社群打造的多功能智慧助手。它不僅整合了 **OpenAI** 與 **Google Gemini** 雙強大語言模型，更具備圖像生成、台灣氣象預報及排程提醒功能，是提升伺服器互動性與便利性的終極解決方案。

## 🚀 核心功能

* **多模型 AI 對話**：支援 OpenAi、Gemini等頂尖模型，具備上下文記憶、自定義人格風格設定與即時翻譯功能。
* **多樣化圖像生成**：整合 DALL-E 3 與 Gemini Image 技術，支援畫質調整與多種比例（直圖、橫圖、方圖）生成。
* **在地化氣象服務**：串接台灣中央氣象署 (CWA) API，提供即時縣市天氣查詢與自動化每日天氣預報。
* **智慧排程管理**：支援斜線指令設定定時提醒，並具備每日固定時間的關懷提醒（支援多人標記與隨機語句）。
* **互動娛樂工具**：內建運勢占卜、隨機選擇、幸運數字等趣味小功能，豐富社群互動。
* **靈活配置管理**：透過 `.env` 與專屬設定檔輕鬆控管各項功能開關與 API 金鑰。

## 🛠️ 安裝與執行教學

### 1. 前置準備
* 確保環境已安裝 **Node.js v18.15.0** 或以上版本。
* 取得 Discord Bot Token、OpenAI API Key、Google Gemini API Key 及中央氣象署 API Key。

### 2. 下載專案
```bash
git clone https://github.com/shirofurenzu/Furenzu_13.git
cd Furenzu_13
```

### 3. 安裝依賴套件
```Bash
npm install
```
### 4. 環境變數設定
請參考專案中的 .env.example 檔案，重新命名為 .env 檔案，編輯 .env 並填入必要的 API 金鑰與頻道 ID，discord說明可參閱下方，Openai、Gemini及氣象署請至官網申請API key

### 5. 啟動機器人
```Bash
npm start
```

## 🤖 伺服器加入與環境設定指南

要在本地或伺服器成功執行 **Furenzu_13**，您需要從 Discord Developer Portal 取得關鍵憑證。以下是詳細的獲取路徑與步驟：

### 1. 取得必要憑證 (Credentials)

請前往 [Discord Developer Portal](https://discord.com/developers/applications) 並選擇您的應用程式：

* **DISCORD_CLIENT_ID**: 
    * 位於 **OAuth2** -> **General** 頁面。
    * 這是在邀請 Bot 以及註冊斜線指令時的核心識別碼。
* **DISCORD_BOT_TOKEN**: 
    * 位於 **Bot** 頁面。
    * 點擊 **Reset Token** (或 Copy) 即可取得。這是 Bot 登入 Discord 的唯一密鑰，**請務必妥善保管，切勿外流**。
* **DISCORD_CHANNEL_ID (頻道 ID)**:
    * 在 Discord 客戶端中，進入 **設定** -> **進階** -> 開啟 **開發者模式**。
    * 回到伺服器，對目標頻道（如：日誌頻道或氣象預報頻道）點擊 **右鍵** -> 選擇 **複製頻道 ID**。

### 2. 產生邀請連結
1.  在 Developer Portal 點擊 **OAuth2** -> **URL Generator**。
2.  在 **Scopes** 勾選：`bot` 與 `applications.commands`。
3.  在 **Bot Permissions** 勾選：
* `檢視頻道 (View Channels)`  **必要**。允許機器人看到頻道，以便接收訊息、指令並做出回應。 
* `讀取訊息歷史 (Read Message History)`  **必要**。讓 AI 能讀取之前的訊息，實現「上下文記憶」的對話功能。 
* `傳送訊息 (Send Messages)`  讓機器人能回覆使用者的問題、發送氣象預報及排程提醒。 
* `嵌入連結 (Embed Links)`  用於發送格式化的「天氣卡片」或呈現 AI 生成圖片的嵌入資訊。 
* `附加檔案 (Attach Files)`  用於將生成的 AI 圖片或圖片分析結果直接上傳到 Discord。 
* `使用斜線指令 (Use Slash Commands)`  允許使用者透過斜線/  呼叫模型切換、翻譯、重設對話等進階功能。 
4.  複製產生的 URL 並貼至瀏覽器，選擇目標伺服器進行授權。

### 3. 配置環境變數
請將取得的資訊填入 `.env` 檔案中：


## 📈 v1.12 更新摘要
最近的重大更新強化了系統的穩定性與使用者體驗：

架構優化：新增 aiBotConfig.js 統一管理 AI 模型參數，將模型設定從環境變數中解耦。

效能升級：全面以 axios 取代 node-fetch，並優化 Discord 事件監聽機制。

繪圖功能進化：新增圖片模型切換功能，並優化橫直圖生成的尺寸設定 (1024×1536)。

錯誤處理強化：優化 API 請求失敗時的錯誤詳細內容提示，包含錯誤代碼與狀態。

部署預備：新增 .env.example 範例檔案，方便開發者快速配置環境。



開發者：Shirofurenzu