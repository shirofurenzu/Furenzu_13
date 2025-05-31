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

      const { data } = await axios.get(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-091?Authorization=${API_KEY}`);
      //console.log(JSON.stringify(data, null, 2)); // 使用 JSON.stringify 格式化輸出，方便閱讀
      const location = data.records.Locations[0].Location.find(l => l.LocationName === `${city}`);
      const cityName = location.LocationName;
      const obsElement = location.WeatherElement;

      const Wx = obsElement.find(e => e.ElementName === '天氣現象');
      const WxTime = Wx.Time[0];
      const WxElementValue = WxTime.ElementValue[0];

      const MinT = obsElement.find(e => e.ElementName === '最低溫度');
      const MinTTime = MinT.Time[0];
      const MinTElementValue = MinTTime.ElementValue[0];

      const MaxT = obsElement.find(e => e.ElementName === '最高溫度');
      const MaxTTime = MaxT.Time[0];
      const MaxTElementValue = MaxTTime.ElementValue[0];

      const MinAT = obsElement.find(e => e.ElementName === '最低體感溫度');
      const MinATTime = MinAT.Time[0];
      const MinATElementValue = MinATTime.ElementValue[0];

      const MaxAT = obsElement.find(e => e.ElementName === '最高體感溫度');
      const MaxATTime = MaxAT.Time[0];
      const MaxATElementValue = MaxATTime.ElementValue[0];

      const PoP12h = obsElement.find(e => e.ElementName === '12小時降雨機率');
      const PoP12hTime = PoP12h.Time[0];
      const PoP12hElementValue = PoP12hTime.ElementValue[0];

      const MinCI = obsElement.find(e => e.ElementName === '最小舒適度指數');
      const MinCITime = MinCI.Time[0];
      const MinCIElementValue = MinCITime.ElementValue[0]?.MinComfortIndexDescription; // 注意這裡的 [0] 和 ?.

      const MaxCI = obsElement.find(e => e.ElementName === '最大舒適度指數');
      const MaxCITime = MaxCI.Time[0];
      const MaxCIElementValue = MaxCITime.ElementValue[0]?.MaxComfortIndexDescription; // 注意這裡的 [0] 和 ?.
      
      const CI = MaxCIElementValue === MinCIElementValue ?
       MinCIElementValue :
       `${MinCIElementValue}至${MaxCIElementValue}`;


      const weatherTwData = `
      【${cityName}天氣】
    氣溫：${MinTElementValue.MinTemperature}℃ - ${MaxTElementValue.MaxTemperature}℃
    體感溫度：${MinATElementValue.MinApparentTemperature}℃ - ${MaxATElementValue.MaxApparentTemperature}℃
    降雨機率：${PoP12hElementValue.ProbabilityOfPrecipitation} ％
    天氣狀況：${WxElementValue.Weather}
    舒適度：${CI}
    預報時間(起)：${WxTime.StartTime}
    預報時間(訖)：${WxTime.EndTime}`;
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