//////////////////////////////////////////////////
require('dotenv').config()
//////////////////////////////////////////////////
const { Client, Intents } = require('discord.js');
const responses = require('./responses');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

function getRandomResponse(responses) {
  if (!responses || responses.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}

/////開機/////
client.on("ready", () => {
  client.user.setPresence({ activities: [{ name: 'Izuna' }], status: 'Online' });
  console.log(`${client.user.tag}已上線!`);
});


client.on('messageCreate', msg => {
  const messageContent = msg.content.toLowerCase();
  let response;
  if (messageContent === '運勢') {
    const luck = ["大吉", "中吉", "小吉", "吉", "末吉", "凶", "大凶"];
    const randomIndex = Math.floor(Math.random() * luck.length);
    response = `主人今天的運勢是：${luck[randomIndex]}！`;
  } else {
    response = getRandomResponse(responses[messageContent]);
  }
  if (response) {
    msg.reply(response);
  }
});

//////////////////////////////////////////////////
client.login(process.env.DISCORD_BOT_TOKEN);