//////////////////////////////////////////////////
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel] // 這部分確保機器人能夠接收 DM
});
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
//const {reminder,reminderToday} = require('./app/reminder.js'); 
//reminder(client);
//reminderToday(client);

/////氣象預報/////
const { weatherTw } = require('./app/weatherTw.js'); 
weatherTw(client);

/////每日氣象/////
const { dailyWeather, dailyWeatherPoP } = require('./app/dailyWeather.js'); 
dailyWeather(client);
dailyWeatherPoP(client);

/////設置每日提醒/////
const {dailyRemind} = require('./app/dailyRemind.js'); 
dailyRemind(client);

/////圖片生成/////
const { generateAndSendImage } = require('./app/generateAndSendImage.js');
generateAndSendImage(client);

/////GPT問答功能/////
//const { autoReplyWithGPT } = require('./app/autoReplyWithGPT.js');
//autoReplyWithGPT(client);

/////斜線指令功能////
//可觸發GPT問答功能autoReplyWithGPT.js
const { registerAllSlashCommands, handleSlashInteractions } = require('./SlashManager');
(async () => {
  await registerAllSlashCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_BOT_TOKEN);
  handleSlashInteractions(client);
})();


/////載入提醒///
client.once('ready', () => {
const modules = require('./SlashManager').loadModules();
  for (const mod of modules) {
    if (mod.handleClientReady) mod.handleClientReady(client);
  }
});