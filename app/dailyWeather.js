const cron = require('node-cron');
const axios = require('axios');
const path = require('path');
const { Events } = require('discord.js');
const config = require('../config/index.js');
const weatherTw = require('./weatherTw');

// 引入外部的天氣排程清單 JSON
let weatherTasks = [];
try {
    weatherTasks = require('../config/dailyWeatherTasks.json');
} catch (error) {
    console.error('❌ 無法讀取 config/dailyWeatherTasks.json，請檢查檔案是否存在。');
}

// 核心啟動函式
function initDailyWeather(client) {
    client.once(Events.ClientReady, () => {
        console.log(`🌦️ 每日天氣模組已載入，共 ${weatherTasks.length} 個排程。`);

        weatherTasks.forEach((task, index) => {
            // 檢查是否啟用
            if (!task.enabled) return;

            // 設定排程
            cron.schedule(task.cron, async () => {
                try {
                    console.log(`執行天氣任務 #${index + 1}: [${task.type}] ${task.location}`);
                    
                    const channel = client.channels.cache.get(config.DAILY_WEATHER_CHANNEL_ID);
                    if (!channel) {
                        console.error(`❌ 錯誤：找不到天氣頻道 ID (${config.DAILY_WEATHER_CHANNEL_ID})`);
                        return;
                    }

                    // 根據類型執行不同的邏輯
                    if (task.type === 'detailed_forecast') {
                        await sendDetailedForecast(channel, task);
                    } else if (task.type === 'simple_pop') {
                        await sendSimplePoP(channel, task);
                    }

                } catch (error) {
                    console.error(`❌ 執行天氣排程失敗 (${task.description}):`, error);
                }
            });
        });
    });
}

// 邏輯 1: 詳細天氣預報 (對應原本的 dailyWeather)
// 使用 API: F-D0047-075 (鄉鎮天氣預報-未來2天天氣預報)
async function sendDetailedForecast(channel, task) {
    const apiUrl = `${task.apiUrl}?Authorization=${process.env.CWB_API_KEY}`;
    const { data } = await axios.get(apiUrl);
    
    const locationData = data.records.Locations[0].Location.find(l => l.LocationName === task.location);
    
    if (!locationData) {
        console.error(`❌ 找不到地點: ${task.location} (請確認 API 是否支援該行政區)`);
        return;
    }

    // 使用 weatherTw 模組進行格式化
    const formattedMsg = weatherTw.filterWeatherData(locationData);
    channel.send(formattedMsg);
}

// 邏輯 2: 簡易降雨機率 (對應原本的 dailyWeatherPoP)
// 使用 API: F-C0032-001 (一般天氣預報-今明36小時天氣預報)
async function sendSimplePoP(channel, task) {
    const apiUrl = `${task.apiUrl}?Authorization=${process.env.CWB_API_KEY}`;
    const { data } = await axios.get(apiUrl);
    
    const locationData = data.records.location.find(l => l.locationName === task.location);

    if (!locationData) {
        console.error(`❌ 找不到縣市: ${task.location} (API F-C0032-001 僅支援縣市層級)`);
        return;
    }

    const weatherElements = locationData.weatherElement.reduce((acc, curr) => {
        acc[curr.elementName] = curr.time[0].parameter;
        return acc;
    }, {});

    const pop = weatherElements.PoP.parameterName; // 降雨機率字串，例如 "20"
    const minT = weatherElements.MinT.parameterName; // 最低溫
    const maxT = weatherElements.MaxT.parameterName; // 最高溫
    const ci = weatherElements.CI.parameterName; // 舒適度

    // === 新增判斷邏輯 ===
    // 如果設定檔有設定 popThreshold (降雨機率門檻)
    if (task.popThreshold !== undefined) {
        const popValue = parseInt(pop, 10);
        
        // 檢查：如果目前降雨機率 < 設定門檻，就不發送
        if (!isNaN(popValue) && popValue < task.popThreshold) {
            console.log(`☔ [跳過通知] ${task.location} 降雨機率 ${popValue}% 未達設定門檻 (${task.popThreshold}%)。`);
            return; // 直接結束函式，不執行下面的 channel.send
        }
    }

    const message = `晚安！\n明天 ${task.location} 的降雨機率是 **${pop}%** ☔\n氣溫約 **${minT}°C - ${maxT}°C**，${ci}。`;
    
    channel.send(message);
}

module.exports = {
    initDailyWeather
};