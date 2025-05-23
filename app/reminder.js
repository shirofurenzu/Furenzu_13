const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const reminderFilePath = path.join(__dirname, '..', 'data', 'reminders.json');
let reminders = [];

// 讀取提醒資料（開機時）
function loadRemindersFromFile(client) {
  if (!fs.existsSync(reminderFilePath)) return;

  const raw = fs.readFileSync(reminderFilePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    reminders = parsed;

    const now = Date.now();
    for (const reminder of reminders) {
      const delay = new Date(reminder.time).getTime() - now;
      if (delay > 0) {
        scheduleReminderTimeout(client, reminder, delay);
      }
    }
  } catch (err) {
    console.error('❌ 無法解析 reminders.json:', err);
  }
}

// 儲存提醒到檔案
function saveRemindersToFile() {
  fs.mkdirSync(path.dirname(reminderFilePath), { recursive: true });
  fs.writeFileSync(reminderFilePath, JSON.stringify(reminders, null, 2));
}

// 設定提醒倒數
function scheduleReminderTimeout(client, reminder, delay) {
  setTimeout(() => {
    client.channels.fetch(reminder.channel).then(channel => {
      channel.send(`🔔 <@${reminder.user}> 提醒您：${reminder.message}`);
    }).catch(console.error);

    // 發送後從列表移除並儲存
    reminders = reminders.filter(r =>
      !(r.user === reminder.user && r.time === reminder.time && r.message === reminder.message)
    );
    saveRemindersToFile();
  }, delay);
}

// 處理指令設定
function scheduleNewReminder(interaction, targetTime, message) {
  const now = new Date();
  const delay = targetTime - now;
  if (delay <= 0) {
    interaction.reply({ content: '❌ 時間已過，請設定未來的時間。', ephemeral: true });
    return;
  }

  const reminder = {
    user: interaction.user.id,
    channel: interaction.channel.id,
    time: targetTime.toISOString(),
    message
  };

  reminders.push(reminder);
  saveRemindersToFile();
  scheduleReminderTimeout(interaction.client, reminder, delay);

  interaction.reply({ content: `⏰ 提醒已設定：${targetTime.toLocaleString()} - ${message}`, ephemeral: true });
}

// 解析時間
function getReminderDate(args, isToday) {
  const now = new Date();
  if (isToday) {
    const [hour, minute] = args.map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
  } else {
    const [month, day, hour, minute] = args.map(Number);
    return new Date(now.getFullYear(), month - 1, day, hour, minute, 0);
  }
}

// Slash 指令定義
const slashCommands = [
  new SlashCommandBuilder()
    .setName('提醒')
    .setDescription('設定提醒 (格式：/提醒 月 日 時 分 事項)')
    .addIntegerOption(opt => opt.setName('月').setDescription('月份').setRequired(true))
    .addIntegerOption(opt => opt.setName('日').setDescription('日期').setRequired(true))
    .addIntegerOption(opt => opt.setName('時').setDescription('小時').setRequired(true))
    .addIntegerOption(opt => opt.setName('分').setDescription('分鐘').setRequired(true))
    .addStringOption(opt => opt.setName('事項').setDescription('提醒事項').setRequired(true)),

  new SlashCommandBuilder()
    .setName('今日提醒')
    .setDescription('設定今天的提醒 (格式：/今日提醒 時 分 事項)')
    .addIntegerOption(opt => opt.setName('時').setDescription('小時').setRequired(true))
    .addIntegerOption(opt => opt.setName('分').setDescription('分鐘').setRequired(true))
    .addStringOption(opt => opt.setName('事項').setDescription('提醒事項').setRequired(true)),
];

// 處理指令
async function handleSlash(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === '提醒') {
    const [month, day, hour, minute] = [
      interaction.options.getInteger('月'),
      interaction.options.getInteger('日'),
      interaction.options.getInteger('時'),
      interaction.options.getInteger('分')
    ];
    const message = interaction.options.getString('事項');
    const targetTime = getReminderDate([month, day, hour, minute], false);
    scheduleNewReminder(interaction, targetTime, message);
  }

  if (interaction.commandName === '今日提醒') {
    const hour = interaction.options.getInteger('時');
    const minute = interaction.options.getInteger('分');
    const message = interaction.options.getString('事項');
    const targetTime = getReminderDate([hour, minute], true);
    scheduleNewReminder(interaction, targetTime, message);
  }
}

async function registerSlashCommands() {
  // 留空，註冊由 SlashManager 統一處理
}

// Bot 啟動時載入提醒
function handleClientReady(client) {
  loadRemindersFromFile(client);
}

module.exports = {
  handleSlash,
  registerSlashCommands,
  slashCommands,
  handleClientReady
};
