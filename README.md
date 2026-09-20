# 🦊 Furenzu_13

Furenzu_13 是以 Node.js 與 Discord.js 建置的 Discord 機器人，整合 OpenAI／Google Gemini 對話與圖片功能、台灣天氣、提醒、行情查詢與日常互動工具。

## 功能

### AI 對話與圖片

- 在已設定的聊天頻道使用 OpenAI 或 Google Gemini 回覆文字與分析上傳圖片。
- 對話紀錄依使用者與頻道分開保存，最多 10 筆訊息。
- 支援對話風格、模型切換、翻譯與清除對話紀錄。
- 在已設定的繪圖頻道傳送文字即可生成圖片，支援 OpenAI 與 Gemini。
- OpenAI 提示可加入 `直圖` 或 `橫圖` 切換尺寸；未指定時使用正方形尺寸。

AI 頻道、預設模型及可選模型由 `config/aiBotConfig.js` 管理。實際可用性取決於 API key、帳戶權限與供應商服務狀態。

### 天氣、提醒與行情

- 傳送 `天氣`、`臺北天氣`、`台中天氣` 或以 `☀️` 結尾的訊息可查詢台灣縣市天氣；預設為臺中市。
- `config/dailyWeatherTasks.json` 可設定每日詳細預報或降雨機率門檻通知。
- `/提醒 設定`、`/提醒 今日`、`/提醒 刪除` 可管理個人提醒；資料儲存在執行期建立的 `data/reminders.json`。
- `config/dailyReminders.json` 可設定 cron、隨機提醒訊息及多位使用者標記。
- `/市場行情` 顯示設定中的加密貨幣、美股、台股及選用的個人持股損益。
- `/股價查詢` 查詢單一標的；純數字台股代號會依序嘗試 `.TW` 與 `.TWO`。

天氣資料使用中央氣象署（CWA）開放資料 API；行情資料使用 Yahoo Finance chart API。


## 斜線指令

| 指令 | 說明 |
| --- | --- |
| `/風格`、`/正常風格` | 設定或清除目前頻道的 AI 對話風格 |
| `/翻譯` | 翻譯文字；預設為台灣繁體中文 |
| `/切換模型`、`/預設模型` | 切換或恢復 AI 對話模型 |
| `/重設` | 清除目前頻道的對話紀錄 |
| `/切換繪圖模型`、`/預設繪圖模型` | 切換或恢復繪圖模型設定 |
| `/提醒` | 建立、管理或刪除個人提醒 |
| `/市場行情`、`/股價查詢` | 查詢市場行情或單一標的 |

> 機器人啟動時會註冊全域斜線指令，Discord 顯示更新可能需要一些時間。

## 安裝

### 前置需求

- 建議 Node.js 18 或更新版本（專案目前未在 `package.json` 強制指定版本）。
- Discord Bot Token 與 Application／Client ID。
- 視啟用功能準備 OpenAI、Gemini、Gemini 圖片生成及 CWA API key。

```bash
git clone https://github.com/shirofurenzu/Furenzu_13.git
cd Furenzu_13
npm ci
```

不使用 lockfile 時可改用 `npm install`。

複製環境變數範例檔：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

### `.env` 設定

#### 必要設定

```dotenv
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
```

#### AI 頻道與 API

```dotenv
DISCORD_CHANNEL_CHAT=
DISCORD_CHANNEL_GPT_CHAT=
DISCORD_CHANNEL_GPT_IMAGE=
DISCORD_CHANNEL_GEMINI_CHAT=
DISCORD_CHANNEL_GEMINI_IMAGE=
OPEN_AI_API_KEY=
GEMINI_API_KEY=
GEMINI_API_KEY_Paid=
```

未設定某個聊天或繪圖頻道 ID 時，該頻道不會啟用相應功能。

#### 天氣、每日提醒與市場報表

```dotenv
CWB_API_KEY=
ENABLE_DAILY_WEATHER=true
DAILY_WEATHER_CHANNEL_ID=
ENABLE_DAILY_REMIND=true
DAILY_REMIND_CHANNEL_ID=
DAILY_REMIND_USER_ID=
ENABLE_MARKET_REPORT=true
MARKET_REPORT_CHANNEL_ID=
```

- 三個 `ENABLE_*` 值設為 `false` 可停用；未設定時預設啟用。
- `DAILY_REMIND_USER_ID` 可填多位 Discord 使用者 ID，並以逗號分隔。
- 市場報表時間與追蹤標的由 `config/marketHoldings.json` 設定。

#### 其他目前會讀取但不影響現行功能的設定

```dotenv
PORT=3000
DISCORD_MODE=channel
DISCORD_CHANNEL_ID=
DISCORD_CHANNEL_MAX_MESSAGE=5
DISCORD_FORUM_ID=
ENABLE_AI_CHAT=true
```

這些設定目前沒有用於控制 HTTP server、AI 功能或訊息數量；`PORT` 不影響機器人啟動。

### 啟動

```bash
npm start
```

這會執行 `node app.js`。目前 `npm test` 尚未配置測試，執行後會直接回傳錯誤。

## Discord Developer Portal 設定

1. 在 [Discord Developer Portal](https://discord.com/developers/applications) 建立或選擇應用程式。
2. 在 **General Information** 取得 Application ID，填入 `DISCORD_CLIENT_ID`。
3. 在 **Bot** 頁面取得 Token，填入 `DISCORD_BOT_TOKEN`。
4. 在 **Bot > Privileged Gateway Intents** 啟用 **Message Content Intent**。
5. 在 **OAuth2 > URL Generator** 選取 Scopes：`bot`、`applications.commands`。
6. 常用權限：View Channels、Send Messages、Read Message History、Embed Links、Attach Files、Use Application Commands。

頻道 ID 可在 Discord 開啟「開發者模式」後，對目標頻道按右鍵並選擇「複製頻道 ID」。

## 設定檔

| 檔案 | 用途 |
| --- | --- |
| `config/aiBotConfig.js` | AI 聊天與繪圖頻道映射、人格、預設模型及可選模型 |
| `config/dailyReminders.json` | 每日提醒 cron、訊息與啟用狀態 |
| `config/dailyWeatherTasks.json` | 每日天氣任務、地點、API URL 與降雨門檻 |
| `config/marketHoldings.json` | 行情標的、個人持股與市場報表 cron |

cron 格式為 `分 時 日 月 週`，例如：

```text
30 8 * * *      # 每天 08:30
0 12 * * 1-5    # 週一至週五 12:00
```

排程使用執行機器人的本機時區，部署時請確認主機時區符合預期。


## 注意事項

- 請勿提交 `.env` 或任何 API key。
- 個人提醒資料需要可持久化的檔案儲存，否則重新部署後會遺失。
- AI 與行情功能會依 API 供應商的可用性、帳戶權限、額度與模型支援狀態而異。
- 專案目前未附 `LICENSE` 檔；公開散布前請補上明確授權條款。

開發者：Shirofurenzu
