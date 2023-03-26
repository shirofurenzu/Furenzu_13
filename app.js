const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

//////////////////////////////////////////////////
const {
  PORT,
  DISCORD_BOT_TOKEN,
} = require('./config');

/////命令及回應指令
const { commandsAndResponses } = require("./commandsAndResponses");

//////////////////////////////////////////////////
/////開機/////
client.on("ready", () => {
  client.user.setPresence({ activities: [{ name: 'Izuna' }], status: 'Online' });
  console.log(`${client.user.tag}已上線!`);

  client.application.commands.set(Object.values(commandsAndResponses)).then(() => {
    console.log("Slash commands registered.");
  }).catch(console.error);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandsAndResponses[commandName]) {
    const response = commandsAndResponses[commandName].getRandomResponse();
    await interaction.reply(response);
  }
});
//////////////////////////////////////////////////
client.login(DISCORD_BOT_TOKEN);