const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const defaultCity = '臺中市'
const API_KEY = process.env.CWB_API_KEY;
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function weatherTw(client) {
  client.on('messageCreate', async (message) => {
  const isEndingWithWeather = message.content.trim().toLowerCase().endsWith('天氣');
  if (!isEndingWithWeather || message.author.bot) return;
  let city = message.content.trim();
  city = city.slice(0, city.length - 2).trim(); // 移除「天氣」兩個字
  city = city.replace(/台/g, "臺");  // 將 "台" 轉換為 "臺"

  if (!city) {
    city = defaultCity; // 預設城市名稱
  } else {
    if (!city.includes('市') && !city.includes('縣')) {
      if (['臺北', '新北', '桃園', '臺中', '臺南', '高雄', '基隆'].includes(city)) {
        city += '市';
      } else if (['宜蘭', '新竹', '苗栗', '彰化', '南投', '雲林', '嘉義', '屏東', '花蓮', '臺東', '澎湖', '金門', '連江'].includes(city)) {
        city += '縣';
      }
    }
  }
  try {
    
    const { data } = await axios.get(`https://opendata.cwb.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${API_KEY}&locationName=${encodeURIComponent(city)}`);
    const location = data.records.location[0];
    const cityName = location.locationName;
    const obsElement = location.weatherElement;
  
    const wx = obsElement.find(e => e.elementName === 'Wx');
    const wxTime = wx.time[0];
    const wxParameter = wxTime.parameter;
  
    const maxT = obsElement.find(e => e.elementName === 'MaxT');
    const maxTTime = maxT.time[0];
    const maxTParameter = maxTTime.parameter;
  
    const minT = obsElement.find(e => e.elementName === 'MinT');
    const minTTime = minT.time[0];
    const minTParameter = minTTime.parameter;
  
    const ci = obsElement.find(e => e.elementName === 'CI');
    const ciTime = ci.time[0];
    const ciParameter = ciTime.parameter;

    const pop = obsElement.find(e => e.elementName === 'PoP');
    const popTime = pop.time[0];
    const popParameter = popTime.parameter;

    const weatherTwData = `【${cityName}】\n溫度：${minTParameter.parameterName}℃（最低）/${maxTParameter.parameterName}℃（最高)\n降雨機率：${popParameter.parameterName} ％\n天氣狀況：${wxParameter.parameterName}\n舒適度：${ciParameter.parameterName}\n預報時間(起)：${wxTime.startTime}\n預報時間(訖)：${wxTime.endTime}`;
    message.channel.send(weatherTwData);
  } catch (error) {
    console.error(error);
    message.reply('查詢天氣資訊時發生錯誤。');
  }
});
};
module.exports = {
  weatherTw,
};