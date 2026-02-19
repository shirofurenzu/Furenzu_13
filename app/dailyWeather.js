const cron = require('node-cron');
const axios = require('axios');
const path = require('path');
const { Events } = require('discord.js');
const config = require('../config/index.js');

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
            if (!task.enabled) return;

            cron.schedule(task.cron, async () => {
                try {
                    console.log(`執行天氣任務 #${index + 1}: [${task.type}] ${task.location}`);
                    
                    const channel = client.channels.cache.get(config.DAILY_WEATHER_CHANNEL_ID);
                    if (!channel) {
                        console.error(`❌ 錯誤：找不到天氣頻道 ID (${config.DAILY_WEATHER_CHANNEL_ID})`);
                        return;
                    }

                    // 統一使用共用的抓取與解析邏輯
                    const locationData = await fetchLocationData(task);
                    if (!locationData) return; // 如果抓不到資料就中止

                    const weather = parseWeatherData(locationData);

                    // 根據類型發送不同訊息
                    if (task.type === 'detailed_forecast') {
                        await sendDetailedMessage(channel, task, locationData, weather);
                    } else if (task.type === 'simple_pop') {
                        await sendSimpleMessage(channel, task, weather);
                    }

                } catch (error) {
                    console.error(`❌ 執行天氣排程失敗 (${task.description}):`, error);
                }
            });
        });
    });
}

// === 共用函式 1: 抓取並尋找地點資料 (F-D0047-075 結構) ===
async function fetchLocationData(task) {
    const apiUrl = `${task.apiUrl}?Authorization=${process.env.CWB_API_KEY}`;
    const { data } = await axios.get(apiUrl);
    
    // 兼容 cwaopendata (OpenData) 與 records (REST API) 格式
    let locations = null;
    if (data.cwaopendata && data.cwaopendata.Dataset && data.cwaopendata.Dataset.Locations && data.cwaopendata.Dataset.Locations.Location) {
            locations = data.cwaopendata.Dataset.Locations.Location;
    } else if (data.records && data.records.Locations && data.records.Locations[0] && data.records.Locations[0].Location) {
            locations = data.records.Locations[0].Location;
    } else if (data.records && data.records.locations && data.records.locations[0] && data.records.locations[0].location) { 
            locations = data.records.locations[0].location;
    }
    
    if (!locations) {
        console.error('❌ API 回傳資料結構異常，找不到 Locations 欄位。');
        return null;
    }

    const locationData = locations.find(l => (l.LocationName || l.locationName) === task.location);
    
    if (!locationData) {
        console.error(`❌ 找不到地點: ${task.location} (請確認該 API 是否包含此行政區/縣市)`);
        return null;
    }

    return locationData;
}

// === 共用函式 2: 解析天氣因子 (回傳乾淨的物件) ===
function parseWeatherData(locationData) {
    const weatherElements = locationData.WeatherElement || locationData.weatherElement || [];
    
    const result = {
        wx: '未知',
        pop: '0',
        minT: '?',
        maxT: '?',
        minAT: '?',
        maxAT: '?',
        minCIDesc: '', 
        maxCIDesc: '',
        ci: ''
    };

    weatherElements.forEach(el => {
        const name = el.ElementName || el.elementName;
        const timeArray = el.Time || el.time;
        if (!timeArray || timeArray.length === 0) return;

        let valContainer = timeArray[0].ElementValue || timeArray[0].elementValue;
        if (Array.isArray(valContainer)) valContainer = valContainer[0];
        if (!valContainer) return;

        let value = valContainer.value || valContainer.parameterName || valContainer.Weather;
        if (value === undefined && typeof valContainer === 'object') {
             const keys = Object.keys(valContainer);
             if (keys.length > 0) value = valContainer[keys[0]];
        }

        // 1. 天氣現象
        if (name === '天氣現象') result.wx = valContainer.Weather || value;
        // 2. 降雨機率
        if (name === '12小時降雨機率') result.pop = value;
        // 3. 溫度
        if (name === '最低溫度') result.minT = value;
        if (name === '最高溫度') result.maxT = value;
        // 4. 體感溫度
        if (name === '最低體感溫度') result.minAT = value;
        if (name === '最高體感溫度') result.maxAT = value;
        // 5. 舒適度
        if (name === '最小舒適度指數' || name === '最小舒適度指數說明') {
             result.minCIDesc = valContainer.MinComfortIndexDescription || valContainer.ComfortIndexDescription || value;
        }
        if (name === '最大舒適度指數' || name === '最大舒適度指數說明') {
             result.maxCIDesc = valContainer.MaxComfortIndexDescription || valContainer.ComfortIndexDescription || value;
        }
    });

    // 舒適度組裝
    if (result.minCIDesc && result.maxCIDesc) {
        result.ci = (result.minCIDesc === result.maxCIDesc) ? result.minCIDesc : `${result.minCIDesc} 至 ${result.maxCIDesc}`;
    } else if (result.minCIDesc) {
        result.ci = result.minCIDesc;
    } else if (result.maxCIDesc) {
        result.ci = result.maxCIDesc;
    }

    return result;
}

// 邏輯 1: 發送詳細預報訊息
async function sendDetailedMessage(channel, task, locationData, weather) {
    const locationName = locationData.LocationName || locationData.locationName;
    console.log(`✅ [詳細] 成功取得資料: ${locationName}`);

    const msg = `早安！☀️\n**${locationName}**今日${weather.wx}\n` +
           `🌡️ 氣溫：${weather.minT}°C - ${weather.maxT}°C\n` +
           `🌡️ 體感：${weather.minAT}°C - ${weather.maxAT}°C\n` +
           `☔ 降雨機率：${weather.pop}%\n` +
           `👕 舒適度：${weather.ci}`;
    
    channel.send(msg);
}

// 邏輯 2: 發送簡易降雨機率訊息
async function sendSimpleMessage(channel, task, weather) {
    console.log(`✅ [簡易] 成功取得資料: ${task.location}`);

    // 檢查降雨機率門檻
    if (task.popThreshold !== undefined) {
        const popValue = parseInt(weather.pop, 10);
        if (!isNaN(popValue) && popValue < task.popThreshold) {
            console.log(`☔ [跳過通知] ${task.location} 降雨機率 ${popValue}% 未達設定門檻 (${task.popThreshold}%)。`);
            return; 
        }
    }

    // 簡易版訊息
    const msg = `晚安！\n今晚 ${task.location} 的降雨機率是 **${weather.pop}%** ☔\n氣溫約 **${weather.minT}°C - ${weather.maxT}°C**，${weather.ci}。`;
    
    channel.send(msg);
}

module.exports = {
    initDailyWeather
};