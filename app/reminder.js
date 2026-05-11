const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ComponentType,
  Events 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const reminderFilePath = path.join(__dirname, '..', 'data', 'reminders.json');
let reminders = [];

// === 資料處理功能 ===

// 讀取提醒資料
function loadRemindersFromFile() {
  if (!fs.existsSync(reminderFilePath)) return;
  try {
    const raw = fs.readFileSync(reminderFilePath, 'utf8');
    reminders = JSON.parse(raw);
  } catch (err) {
    console.error('❌ 無法解析 reminders.json:', err);
  }
}

// 儲存提醒到檔案
function saveRemindersToFile() {
  fs.mkdirSync(path.dirname(reminderFilePath), { recursive: true });
  fs.writeFileSync(reminderFilePath, JSON.stringify(reminders, null, 2));
}

// === 時間解析邏輯 (含自動跨年判定) ===

function getReminderDate(args, isToday) {
  const now = new Date();
  const year = now.getFullYear();
  
  if (isToday) {
    const [hour, minute] = args.map(Number);
    let targetDate = new Date(year, now.getMonth(), now.getDate(), hour, minute, 0);
    // 如果時間已過，自動判定為明天
    if (targetDate < now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    return targetDate;
  } else {
    const [month, day, hour, minute] = args.map(Number);
    let targetDate = new Date(year, month - 1, day, hour, minute, 0);
    // 如果設定的日期已過，自動判定為明年
    if (targetDate < now) {
      targetDate.setFullYear(year + 1);
    }
    return targetDate;
  }
}

// === 斜線指令定義 (整合功能) ===

const slashCommands = [
  new SlashCommandBuilder()
    .setName('提醒')
    .setDescription('綜合提醒功能管理')
    // 子指令：設定一般提醒
    .addSubcommand(sub =>
      sub.setName('設定')
        .setDescription('設定特定日期的提醒 (若日期已過則自動設為明年)')
        .addIntegerOption(opt => opt.setName('月').setDescription('月份').setRequired(true))
        .addIntegerOption(opt => opt.setName('日').setDescription('日期').setRequired(true))
        .addIntegerOption(opt => opt.setName('時').setDescription('小時').setRequired(true))
        .addIntegerOption(opt => opt.setName('分').setDescription('分鐘').setRequired(true))
        .addStringOption(opt => opt.setName('事項').setDescription('提醒事項').setRequired(true))
    )
    // 子指令：設定今日提醒
    .addSubcommand(sub =>
      sub.setName('今日')
        .setDescription('快速設定今天的提醒 (若時間已過則自動設為明天)')
        .addIntegerOption(opt => opt.setName('時').setDescription('小時').setRequired(true))
        .addIntegerOption(opt => opt.setName('分').setDescription('分鐘').setRequired(true))
        .addStringOption(opt => opt.setName('事項').setDescription('提醒事項').setRequired(true))
    )
    // 子指令：刪除提醒
    .addSubcommand(sub =>
      sub.setName('刪除')
        .setDescription('查看並選擇要刪除的預約提醒')
    ),
];

// === 指令處理器 ===

async function handleSlash(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== '提醒') return;

  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  // 1. 處理：設定提醒 (一般 & 今日)
  if (subcommand === '設定' || subcommand === '今日') {
    let targetTime;
    let message;

    if (subcommand === '設定') {
      const month = interaction.options.getInteger('月');
      const day = interaction.options.getInteger('日');
      const hour = interaction.options.getInteger('時');
      const minute = interaction.options.getInteger('分');
      message = interaction.options.getString('事項');
      targetTime = getReminderDate([month, day, hour, minute], false);
    } else {
      const hour = interaction.options.getInteger('時');
      const minute = interaction.options.getInteger('分');
      message = interaction.options.getString('事項');
      targetTime = getReminderDate([hour, minute], true);
    }

    const newReminder = {
      user: userId,
      channel: interaction.channel.id,
      time: targetTime.toISOString(),
      message
    };

    reminders.push(newReminder);
    saveRemindersToFile();

    return interaction.reply({ 
      content: `⏰ 提醒已設定：**${targetTime.toLocaleString('zh-TW')}**\n事項：${message}`, 
      ephemeral: true 
    });
  }

  // 2. 處理：刪除提醒 (選單模式)
  if (subcommand === '刪除') {
    const userReminders = reminders.filter(r => r.user === userId);

    if (userReminders.length === 0) {
      return interaction.reply({ content: '📭 你目前沒有任何預約中的提醒。', ephemeral: true });
    }

    const options = userReminders.slice(0, 25).map((r, index) => ({
      label: `${new Date(r.time).toLocaleString('zh-TW')}`,
      description: r.message.substring(0, 50),
      value: `del_${userId}_${new Date(r.time).getTime()}_${index}`
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('delete_reminder_menu')
      .setPlaceholder('請選擇要刪除的提醒項目')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
      content: '請從下方選單選擇要刪除的項目：',
      components: [row],
      ephemeral: true
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000 
    });

    collector.on('collect', async i => {
      if (i.customId === 'delete_reminder_menu') {
        const selectedValue = i.values[0];
        const beforeCount = reminders.length;
        
        // 刪除邏輯：根據使用者 ID 與時間戳記比對
        reminders = reminders.filter(r => {
          const rId = `del_${r.user}_${new Date(r.time).getTime()}`;
          return !selectedValue.startsWith(rId);
        });

        if (reminders.length < beforeCount) {
          saveRemindersToFile();
          await i.update({ content: '✅ 提醒已成功刪除！', components: [] });
        } else {
          await i.update({ content: '❌ 刪除失敗，該提醒可能已過期。', components: [] });
        }
      }
    });
  }
}

// === 核心功能：輪詢檢查機制 (每分鐘檢查一次) ===

function initPolling(client) {
  // 每分鐘的第 0 秒執行
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    // 找出所有已到期的提醒
    const expiredReminders = reminders.filter(r => new Date(r.time) <= now);

    if (expiredReminders.length === 0) return;

    for (const reminder of expiredReminders) {
      try {
        const channel = await client.channels.fetch(reminder.channel);
        if (channel) {
          await channel.send(`🔔 <@${reminder.user}> 提醒您：${reminder.message}`);
        }
      } catch (err) {
        console.error(`❌ 發送提醒失敗 (Channel: ${reminder.channel}):`, err);
      }
    }

    // 從記憶體中移除已發送的提醒並同步到檔案
    reminders = reminders.filter(r => !expiredReminders.includes(r));
    saveRemindersToFile();
    console.log(`✅ [輪詢] 已處理 ${expiredReminders.length} 項提醒。`);
  });
}

// Bot 啟動時的初始化
function handleClientReady(client) {
  loadRemindersFromFile();
  initPolling(client);
  console.log('✅ [模組] 提醒功能輪詢機制已啟動');
}

module.exports = {
  handleSlash,
  slashCommands,
  handleClientReady
};
