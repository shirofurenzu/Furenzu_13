//////////////////////////////////////////////////
require('dotenv').config()
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
client.login(process.env.DISCORD_BOT_TOKEN);
//////////////////////////////////////////////////
/////開機/////
client.on("ready", () => {
  client.user.setPresence({ activities: [{ name: 'Izuna' }], status: 'Online' });
  console.log(`${client.user.tag}已上線!`);
  });
  
/////發言紀錄到終端機/////
client.on('messageCreate', async (message) => {
  if (message.author?.bot) return;
  console.log(`「${message.channel.name}」${message.author.username}：${message.content} `);
});

/////回應/////
const {randomChoose, randomNumber, randomResponse, luck,} = require('./app/messageHandler');
randomChoose(client);
randomNumber(client);
randomResponse(client);
luck(client);

/////設置提醒/////
const {reminder} = require('./app/reminder.js'); 
reminder(client);

/////氣象預報/////
const { weatherTw } = require('./app/weatherTw.js'); 
weatherTw(client);

/////每日氣象/////
const { dailyWeather } = require('./app/dailyWeather.js'); 
dailyWeather(client);

/////設置每日提醒/////
//const {dailyremind} = require('./app/dailyremind.js'); 
//dailyremind(client)
