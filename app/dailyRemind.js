const cron = require('node-cron');
const { Events } = require('discord.js');
const config = require('../config/index.js');

// 引入外部的提醒清單 JSON
let reminderList = [];
try {
    reminderList = require('../config/dailyReminders.json');
} catch (error) {
    console.error('❌ 無法讀取 config/dailyReminders.json，請檢查檔案是否存在。');
}

function dailyRemind(client) {
    // 使用 ClientReady 確保機器人已完全啟動
    client.once(Events.ClientReady, () => {
        console.log(`📅 每日提醒模組已載入，共 ${reminderList.length} 個排程。`);

        reminderList.forEach((reminder, index) => {
            // 檢查是否啟用 (如果有設定 enabled: false 則跳過)
            if (reminder.enabled === false) return;
            // 檢查是否有 cron 設定
            if (!reminder.cron) return;

            // 註冊排程
            cron.schedule(reminder.cron, () => {
                try {
                    // 處理使用者標記
                    // 支援多個 ID (逗號分隔)
                    let userTags = '';
                    if (config.DAILY_REMIND_USER_ID) {
                        userTags = config.DAILY_REMIND_USER_ID.split(',')
                            .map(id => `<@${id.trim()}>`)
                            .join(' ');
                    }

                    // === 隨機訊息處理邏輯 ===
                    let selectedMessage = '';
                    if (Array.isArray(reminder.message)) {
                        // 如果是陣列，隨機抽選一句
                        const randomIndex = Math.floor(Math.random() * reminder.message.length);
                        selectedMessage = reminder.message[randomIndex];
                    } else {
                        // 如果是單一字串，直接使用
                        selectedMessage = reminder.message;
                    }

                    // 替換訊息內容
                    const finalMessage = selectedMessage.replace('{user}', userTags);

                    // 取得頻道並發送
                    const channel = client.channels.cache.get(config.DAILY_REMIND_CHANNEL_ID);
                    
                    if (channel) {
                        channel.send(finalMessage)
                            .then(() => console.log(`✅ [提醒] 已發送: ${finalMessage}`))
                            .catch(e => console.error(`❌ [提醒] 發送失敗: ${e}`));
                    } else {
                        console.error(`❌ [提醒] 錯誤: 找不到頻道 ID (${config.DAILY_REMIND_CHANNEL_ID})`);
                    }

                } catch (error) {
                    console.error(`❌ [提醒] 執行任務 #${index + 1} 時發生錯誤:`, error);
                }
            });
            
            
        });
    });
}

module.exports = {
    dailyRemind,
};