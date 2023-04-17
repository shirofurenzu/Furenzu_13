const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const defaultCity = '臺中市'
const API_KEY = process.env.CWB_API_KEY;
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function weatherTw(client) {
  client.on('messageCreate', async (message) => {
    const isEndingWithWeather = message.content.trim().toLowerCase().endsWith('天氣') || message.content.trim().toLowerCase().endsWith('☀️');
    if (!isEndingWithWeather || message.author.bot) return;
    let city = message.content.trim().replace(/(天氣|☀️)$/i, ''); // 移除「天氣」或「:sunny:」
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

      const { data } = await axios.get(`https://opendata.cwb.gov.tw/api/v1/rest/datastore/F-D0047-091?Authorization=${API_KEY}`);
      const location = data.records.locations[0].location.find(l => l.locationName === `${city}`);
      const cityName = location.locationName;
      const obsElement = location.weatherElement;

      const Wx = obsElement.find(e => e.elementName === 'Wx');
      const WxTime = Wx.time[0];
      const WxelementValue = WxTime.elementValue[0];

      const MinT = obsElement.find(e => e.elementName === 'MinT');
      const MinTTime = MinT.time[0];
      const MinTelementValue = MinTTime.elementValue[0];

      const MaxT = obsElement.find(e => e.elementName === 'MaxT');
      const MaxTTime = MaxT.time[0];
      const MaxTelementValue = MaxTTime.elementValue[0];

      const MinAT = obsElement.find(e => e.elementName === 'MinAT');
      const MinATTime = MinAT.time[0];
      const MinATelementValue = MinATTime.elementValue[0];

      const MaxAT = obsElement.find(e => e.elementName === 'MaxAT');
      const MaxATTime = MaxAT.time[0];
      const MaxATelementValue = MaxATTime.elementValue[0];

      const PoP12h = obsElement.find(e => e.elementName === 'PoP12h');
      const PoP12hTime = PoP12h.time[0];
      const PoP12helementValue = PoP12hTime.elementValue[0];

      const MinCI = obsElement.find(e => e.elementName === 'MinCI');
      const MinCITime = MinCI.time[0];
      const MinCIelementValue = MinCITime.elementValue[1];

      const MaxCI = obsElement.find(e => e.elementName === 'MaxCI');
      const MaxCITime = MaxCI.time[0];
      const MaxCIelementValue = MaxCITime.elementValue[1];

      const CI = MaxCIelementValue.value === MinCIelementValue.value ?
        MinCIelementValue.value :
        `${MinCIelementValue.value}至${MaxCIelementValue.value}`;

      const weatherTwData = `【${cityName}天氣】\n氣溫：${MinTelementValue.value}℃ - ${MaxTelementValue.value}℃\n體感溫度：${MinATelementValue.value}℃ - ${MaxATelementValue.value}℃\n降雨機率：${PoP12helementValue.value} ％\n天氣狀況：${WxelementValue.value}\n舒適度：${CI}\n預報時間(起)：${WxTime.startTime}\n預報時間(訖)：${WxTime.endTime}`;
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