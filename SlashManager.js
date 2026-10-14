const fs = require('fs');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

const modulesPath = path.join(__dirname, 'app');
let loadedModules = [];

function loadModules() {
  loadedModules = [];
  fs.readdirSync(modulesPath).forEach(file => {
    if (file.endsWith('.js')) {
      const mod = require(path.join(modulesPath, file));
      if (mod.handleSlash || mod.handleMessage || mod.handleComponent) {
        loadedModules.push(mod);
      }
    }
  });
  return loadedModules;
}

async function registerAllSlashCommands(clientId, token) {
  if (!token || !clientId) throw new Error('❌ 缺少 DISCORD_TOKEN 或 CLIENT_ID');

  const allCommands = [];
  const modules = loadModules();

  for (const mod of modules) {
    if (mod.registerSlashCommands) {
      await mod.registerSlashCommands(clientId, token);
    }
    if (mod.slashCommands) {
      allCommands.push(...mod.slashCommands);
    }
  }

  if (allCommands.length > 0) {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationCommands(clientId), {
      body: allCommands.map(cmd => cmd.toJSON())
    });
    console.log('✅ 所有斜線指令已註冊');
  }
}

function handleSlashInteractions(client) {
  const modules = loadedModules.length ? loadedModules : loadModules();

  // 單一模組出錯（例如互動逾時）只記錄錯誤，不讓整個 bot 因未處理的 error 事件而結束。
  async function runSafely(label, task) {
    try {
      await task();
    } catch (error) {
      console.error(`${label} 執行失敗：`, error);
    }
  }

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      for (const mod of modules) {
        if (mod.handleSlash) await runSafely(`斜線指令 /${interaction.commandName}`, () => mod.handleSlash(interaction));
      }
      return;
    }

    if (interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      for (const mod of modules) {
        if (mod.handleComponent) await runSafely(`互動元件 ${interaction.customId}`, () => mod.handleComponent(interaction));
      }
    }
  });

  client.on('messageCreate', async (message) => {
    for (const mod of modules) {
      if (mod.handleMessage) await runSafely('訊息處理', () => mod.handleMessage(message));
    }
  });
}

module.exports = { registerAllSlashCommands, handleSlashInteractions ,loadModules};
