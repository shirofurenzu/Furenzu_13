const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const defaultLocation = '西屯區';
const channelName = '1088826285482070207';
const replyTime = '0 7 * * *'; //分 小時 日 月 星期
const replyTime2 = '00 17 * * *'; //分 小時 日 月 星期
const API_KEY = process.env.CWB_API_KEY;
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function dailyWeather(client) {
  const cron = require('node-cron');
  cron.schedule(replyTime, async () => {
    try {
      const { data } = await axios.get(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-075?Authorization=${API_KEY}`);
      const cityName = data.records.Locations[0].LocationsName;
      const location = data.records.Locations[0].Location.find(l => l.LocationName === `${defaultLocation}`);
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
      
            
      const weatherTwData = `早安!\n今天上午${WxElementValue.Weather}\n氣溫：${MinTElementValue.MinTemperature}℃ - ${MaxTElementValue.MaxTemperature}℃\n體感溫度：${MinATElementValue.MinApparentTemperature}℃ - ${MaxATElementValue.MaxApparentTemperature}℃\n降雨機率：${PoP12hElementValue.ProbabilityOfPrecipitation} ％\n${CI}`;
      console.log(weatherTwData);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
      client.channels.cache.get(channelName).send(weatherTwData);
    } catch (error) {
      console.error(error);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
    }
  });
}

function dailyWeatherPoP(client) {
  const cron = require('node-cron');
  cron.schedule(replyTime2, async () => {
    try {
      const { data } = await axios.get(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-075?Authorization=${API_KEY}`);
      const cityName = data.records.Locations[0].LocationsName;
      const location = data.records.Locations[0].Location.find(l => l.LocationName === `${defaultLocation}`);
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
      
            
      const weatherTwData = `晚安!\n今晚${WxElementValue.Weather}\n氣溫：${MinTElementValue.MinTemperature}℃ - ${MaxTElementValue.MaxTemperature}℃\n體感溫度：${MinATElementValue.MinApparentTemperature}℃ - ${MaxATElementValue.MaxApparentTemperature}℃\n降雨機率：${PoP12hElementValue.ProbabilityOfPrecipitation} ％\n${CI}`;
      console.log(weatherTwData);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
      if (PoP12hElementValue.ProbabilityOfPrecipitation >= 50) {
      client.channels.cache.get(channelName).send(weatherTwData);
      }
    } catch (error) {
      console.error(error);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
    }
  });
}

module.exports = {
  dailyWeather,
  dailyWeatherPoP,
};
