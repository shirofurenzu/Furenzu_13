const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const config = require('../config/index.js'); // 引入設定檔

// --- 0. 讀取持股設定檔 (config/marketHoldings.json) ---
function loadHoldings() {
    try {
        // 使用絕對路徑並清除快取，方便修改設定後不用重啟也能重新讀取
        const holdingsPath = path.join(__dirname, '..', 'config', 'marketHoldings.json');
        delete require.cache[require.resolve(holdingsPath)];
        return require(holdingsPath);
    } catch (e) {
        console.error('❌ [財經報表] 讀取 marketHoldings.json 失敗:', e.message);
        return { crypto: [], usStocks: [], twStocks: [], personalHoldings: [] };
    }
}

// --- 1. 斜線指令定義 ---
const slashCommands = [
    new SlashCommandBuilder()
        .setName('市場行情')
        .setDescription('獲取當前加密貨幣、美股與台股行情 (含個人持股損益)'),
    new SlashCommandBuilder()
        .setName('股價查詢')
        .setDescription('單次查詢任意股票/加密貨幣即時報價')
        .addStringOption(option =>
            option
                .setName('代號')
                .setDescription('輸入代號，例如：2330、AAPL、BTC-USD')
                .setRequired(true)
        )
];

// --- 2. 核心抓取邏輯 (共用) ---
// 回傳單一標的的原始資料，供顯示與損益計算使用
async function fetchQuote(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
    const meta = res.data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose;
    const change = ((price - prevClose) / prevClose * 100);
    return {
        price,
        prevClose,
        change,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        currency: meta.currency,
        name: meta.longName || meta.shortName || meta.symbol
    };
}

// 依輸入猜測可能的代號 (純數字視為台股，依序嘗試上市 .TW / 上櫃 .TWO)
function resolveSymbolCandidates(rawInput) {
    const input = rawInput.trim();
    if (/^\d{4,6}$/.test(input)) {
        return [`${input}.TW`, `${input}.TWO`];
    }
    return [input.toUpperCase()];
}

// 從設定檔中找出已知標的的顯示名稱
function findKnownName(symbol, holdings) {
    const all = [
        ...(holdings.crypto || []),
        ...(holdings.usStocks || []),
        ...(holdings.twStocks || []),
        ...(holdings.personalHoldings || [])
    ];
    const found = all.find(i => i.symbol.toUpperCase() === symbol.toUpperCase());
    return found ? found.name : null;
}

// 單次查詢單一標的報價 (供斜線指令使用)
async function queryOneQuote(rawInput) {
    const holdings = loadHoldings();
    const candidates = resolveSymbolCandidates(rawInput);

    let result = null;
    let usedSymbol = null;
    for (const symbol of candidates) {
        try {
            result = await fetchQuote(symbol);
            usedSymbol = symbol;
            break;
        } catch (e) {
            continue;
        }
    }

    if (!result) {
        return `❌ 查詢失敗，找不到代號 **${rawInput}** 的報價\n(若為台股，可直接輸入數字代號，機器人會自動嘗試 .TW / .TWO)`;
    }

    const displayName = findKnownName(usedSymbol, holdings) || result.name || usedSymbol;
    const emoji = result.change >= 0 ? '📈' : '📉';
    const sign = result.change > 0 ? '+' : '';

    let msg = `🔎 **${displayName}** (${usedSymbol})\n`;
    msg += `現價: ${result.price.toLocaleString()} ${result.currency || ''}\n`;
    msg += `漲跌: ${emoji} ${sign}${result.change.toFixed(2)}% (昨收 ${result.prevClose.toLocaleString()})`;
    if (result.high != null && result.low != null) {
        msg += `\n區間: ${result.low.toLocaleString()} ~ ${result.high.toLocaleString()}`;
    }
    return msg;
}

// 產生單一標的的行情文字
async function formatQuoteLine(item) {
    try {
        const { price, change } = await fetchQuote(item.symbol);
        const emoji = change >= 0 ? '📈' : '📉';
        const sign = change > 0 ? '+' : '';
        return `**${item.name}**: ${price.toLocaleString()} (${emoji} ${sign}${change.toFixed(2)}%)`;
    } catch (e) {
        return `❌ **${item.name || item.symbol}**: 抓取失敗`;
    }
}

// 產生個人持股區塊 (市值 + 損益)
async function formatHoldingsSection(holdings) {
    let totalValue = 0;
    let totalCost = 0;
    let hasValid = false;
    const lines = [];

    for (const h of holdings) {
        try {
            const { price } = await fetchQuote(h.symbol);
            const shares = Number(h.shares) || 0;
            const cost = Number(h.cost) || 0;
            const marketValue = price * shares;
            const costValue = cost * shares;
            const profit = marketValue - costValue;
            const profitPct = costValue > 0 ? (profit / costValue * 100) : 0;
            const emoji = profit >= 0 ? '🟢' : '🔴';
            const sign = profit >= 0 ? '+' : '';

            totalValue += marketValue;
            totalCost += costValue;
            hasValid = true;

            lines.push(
                `**${h.name}** (${shares.toLocaleString()} 股)\n` +
                `　現價 ${price.toLocaleString()} / 成本 ${cost.toLocaleString()}\n` +
                `　市值 ${Math.round(marketValue).toLocaleString()} ${emoji} ${sign}${Math.round(profit).toLocaleString()} (${sign}${profitPct.toFixed(2)}%)`
            );
        } catch (e) {
            lines.push(`❌ **${h.name || h.symbol}**: 抓取失敗`);
        }
    }

    if (hasValid) {
        const totalProfit = totalValue - totalCost;
        const totalPct = totalCost > 0 ? (totalProfit / totalCost * 100) : 0;
        const emoji = totalProfit >= 0 ? '🟢' : '🔴';
        const sign = totalProfit >= 0 ? '+' : '';
        lines.push(
            `━━━━━━━━━━━━━━\n` +
            `**總計** 市值 ${Math.round(totalValue).toLocaleString()} / 成本 ${Math.round(totalCost).toLocaleString()}\n` +
            `　${emoji} 損益 ${sign}${Math.round(totalProfit).toLocaleString()} (${sign}${totalPct.toFixed(2)}%)`
        );
    }

    return lines.join('\n');
}

async function getMarketReport() {
    const holdings = loadHoldings();
    let message = "💰 **全球資產行情回報**\n";

    if (holdings.crypto && holdings.crypto.length) {
        message += "\n🪙 **加密貨幣**\n";
        for (const item of holdings.crypto) message += await formatQuoteLine(item) + "\n";
    }

    if (holdings.usStocks && holdings.usStocks.length) {
        message += "\n🇺🇸 **美股**\n";
        for (const item of holdings.usStocks) message += await formatQuoteLine(item) + "\n";
    }

    if (holdings.twStocks && holdings.twStocks.length) {
        message += "\n🇹🇼 **台股**\n";
        for (const item of holdings.twStocks) message += await formatQuoteLine(item) + "\n";
    }

    if (holdings.personalHoldingsEnabled !== false && holdings.personalHoldings && holdings.personalHoldings.length) {
        message += "\n📊 **我的持股**\n";
        message += await formatHoldingsSection(holdings.personalHoldings) + "\n";
    }

    return message;
}

// --- 3. 處理斜線指令 (指令觸發) ---
async function handleSlash(interaction) {
    if (interaction.commandName === '市場行情') {
        await interaction.deferReply();
        const report = await getMarketReport();
        await interaction.editReply(report);
        return;
    }

    if (interaction.commandName === '股價查詢') {
        await interaction.deferReply();
        const rawInput = interaction.options.getString('代號');
        const result = await queryOneQuote(rawInput);
        await interaction.editReply(result);
        return;
    }
}

// --- 4. 處理定時任務---
function handleClientReady(client) {
    // 檢查功能是否開啟
    if (config.ENABLE_MARKET_REPORT === false) return;

    const holdings = loadHoldings();
    const cronTime = holdings.reportCron;
    const channelId = config.MARKET_REPORT_CHANNEL_ID;

    if (!cronTime) {
        console.error(`❌ [財經報表] 未設定 reportCron (config/marketHoldings.json)`);
        return;
    }

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
