const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const defaultLocation = '西屯區';
const channelName = '1088826285482070207';
const replyTime = '0 7 * * *' ; //分 小時 日 月 星期
const API_KEY = process.env.CWB_API_KEY;
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function dailyWeather(client) {
  const cron = require('node-cron');
  cron.schedule(replyTime, async () => {
    try {
      const { data } = await axios.get(`https://opendata.cwb.gov.tw/api/v1/rest/datastore/F-D0047-075?Authorization=${API_KEY}`);
      //const defaultCity = '西屯區';
      const cityName = data.records.locations[0].locationsName;
      const location = data.records.locations[0].location.find(l => l.locationName === `${defaultLocation}`);
      const obsElement = location.weatherElement;
      const weatherDescription = obsElement.find(e => e.elementName === 'WeatherDescription');
      const weatherDescriptionTime = weatherDescription.time[0];
      const weatherDescriptionelementValue = weatherDescriptionTime.elementValue[0];
      const weatherTwData = `早安!今天上午${weatherDescriptionelementValue.value}`;
      console.log(weatherTwData);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
      client.channels.cache.get(channelName).send(weatherTwData);
    }catch (error) {
      console.error(error);
      const channel = client.channels.cache.find(channel => channel.name === channelName);
      }
  });
}
module.exports = {
  dailyWeather,
};
