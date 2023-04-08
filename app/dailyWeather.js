const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const defaultLocation = '西屯區';
const channelName = '1088826285482070207';
const replyTime = '0 7 * * *'; //分 小時 日 月 星期
const API_KEY = process.env.CWB_API_KEY;
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function dailyWeather(client) {
  const cron = require('node-cron');
  cron.schedule(replyTime, async () => {
    try {
      const { data } = await axios.get(`https://opendata.cwb.gov.tw/api/v1/rest/datastore/F-D0047-075?Authorization=${API_KEY}`);
      const cityName = data.records.locations[0].locationsName;
      const location = data.records.locations[0].location.find(l => l.locationName === `${defaultLocation}`);
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
      
      const weatherTwData = `早安!\n今天上午${WxelementValue.value}\n氣溫：${MinTelementValue.value}℃-${MaxTelementValue.value}℃\n體感溫度：${MinATelementValue.value}℃-${MaxATelementValue.value}℃\n降雨機率：${PoP12helementValue.value} ％\n${CI}`;
      console.log(weatherTwData);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
      client.channels.cache.get(channelName).send(weatherTwData);
    } catch (error) {
      console.error(error);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
    }
  });
}
module.exports = {
  dailyWeather,
};
