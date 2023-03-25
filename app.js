const { Client, Intents } = require("discord.js");
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});
//////////////////////////////////////////////////
const {
  PORT,
  DISCORD_BOT_TOKEN,
} = require('./config');
/////命令及回應指令
const commandsAndResponses = require("./commandsAndResponses");

const commands = Object.keys(commandsAndResponses).map((name) => ({
  name,
  description: commandsAndResponses[name].description,
  category: commandsAndResponses[name].category,
}));

const responses = commandsAndResponses;
//////////////////////////////////////////////////
/////開機/////
client.on('ready', () => {
  client.user.setPresence({ activities: [{ name: 'Izuna' }], status: 'Online' });
  console.log(`${client.user.tag}已上線!`);
    // 建立指令
  client.guilds.cache.forEach((guild) => {
    guild.commands.set(commands).then(() => {
      console.log(`已登錄${guild.name}伺服器`);
    });
  });
});
/////命令及回應指令/////
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  // 搜尋回應
  const response = responses[commandName];
  if (!response) return;

  await interaction.reply(response.response);
});
//////////////////////////////////////////////////
client.login(DISCORD_BOT_TOKEN);