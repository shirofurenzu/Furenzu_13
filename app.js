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

/////回應/////
const { getRandomResponse, handleMessage, responses } = require('./messageHandler');
client.on('messageCreate', handleMessage);

/////設置每日提醒/////
const {dailyremind} = require('./dailyremind.js'); 
dailyremind(client)

/////設置提醒/////
const {reminder} = require('./reminder.js'); 
client.on('messageCreate', async (message) => {
  reminder(message);
});
