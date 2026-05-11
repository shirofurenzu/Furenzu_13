const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const config = require('../config/index.js'); // 引入設定檔

// --- 1. 斜線指令定義 ---
const slashCommands = [
    new SlashCommandBuilder()
        .setName('市場行情')
        .setDescription('獲取當前加密貨幣與美股指數行情')
];

// --- 2. 核心抓取邏輯 (共用) ---
async function getMarketReport() {
    const cryptos = ['BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD'];
    const stocks = ['^DJI', '^GSPC', '^IXIC', '^SOX'];
    
    async function fetchPrice(symbol) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            const meta = res.data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.previousClose;
            const change = ((price - prevClose) / prevClose * 100).toFixed(2);
            const emoji = change >= 0 ? '📈' : '📉';
            
            const nameMap = { 
                '^DJI': '道瓊工業', 
                '^GSPC': 'S&P 500', 
                '^IXIC': '納斯達克', 
                '^SOX': '費城半導體' 
            };
            let displayName = nameMap[symbol] || symbol.replace('-USD', '');
            
            return `**${displayName}**: ${price.toLocaleString()} (${emoji} ${change > 0 ? '+' : ''}${change}%)`;
        } catch (e) {
            return `❌ **${symbol}**: 抓取失敗`;
        }
    }

    let message = "💰 **全球資產行情回報**\n\n🪙 **加密貨幣**\n";
    for (const crypto of cryptos) message += await fetchPrice(crypto) + "\n";
    message += "\n🇺🇸 **美股指數**\n";
    for (const stock of stocks) message += await fetchPrice(stock) + "\n";
    return message;
}

// --- 3. 處理斜線指令 (指令觸發) ---
async function handleSlash(interaction) {
    if (interaction.commandName !== '市場行情') return;
    await interaction.deferReply(); 
    const report = await getMarketReport();
    await interaction.editReply(report);
}

// --- 4. 處理定時任務---
function handleClientReady(client) {
    // 檢查功能是否開啟
    if (config.ENABLE_MARKET_REPORT === false) return;

    const cronTime = config.MARKET_REPORT_CRON;
    const channelId = config.MARKET_REPORT_CHANNEL_ID;

    console.log(`✅ 財經定時回報已啟動`);
    
    cron.schedule(cronTime, async () => {
        const channel = client.channels.cache.get(channelId);
        
        if (channel) {
            try {
                const report = await getMarketReport();
                await channel.send("📢 **早安！這是今日定時財經回報**\n" + report);
                console.log(`✅ [財經報表] 已成功發送`);
            } catch (err) {
                console.error(`❌ [財經報表] 發送失敗:`, err);
            }
        } else {
            console.error(`❌ [財經報表] 找不到指定頻道: ${channelId}`);
        }
    });
}

module.exports = {
    slashCommands,
    handleSlash,
    handleClientReady
};