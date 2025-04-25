const { SlashCommandBuilder } = require('discord.js');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

const CHANNEL_MODEL_MAP = {
  [process.env.DISCORD_CHANNEL_ID]: process.env.OPEN_AI_GPT_MODEL,
  [process.env.DISCORD_CHANNEL_ID2]: process.env.OPEN_AI_GPT_MODEL2,
};

const DEFAULT_PERSONA = process.env.OPEN_AI_GPT_PERSONA || '你是一個樂於助人的助手，會簡潔地回答使用者的問題。';
const userSessions = new Map();
const userStyles = new Map();
const userModels = new Map();

function getSystemPrompt(userId) {
  const style = userStyles.get(userId);
  return style ? `你是一個具備「${style}」風格的聊天助手，請用這種語氣回答使用者問題。` : DEFAULT_PERSONA;
}

function getUserModel(userId, channelId) {
  return userModels.get(userId) || CHANNEL_MODEL_MAP[channelId];
}

const slashCommands = [
  new SlashCommandBuilder().setName('風格').setDescription('設定聊天風格')
    .addStringOption(opt => opt.setName('內容').setDescription('風格名稱').setRequired(true)),

  new SlashCommandBuilder().setName('正常風格').setDescription('清除自訂風格設定'),

  new SlashCommandBuilder().setName('翻譯').setDescription('將文字翻譯為中文')
    .addStringOption(opt => opt.setName('文字').setDescription('要翻譯的內容').setRequired(true)),

  new SlashCommandBuilder().setName('切換模型').setDescription('切換你使用的 GPT 模型')
    .addStringOption(opt => opt.setName('模型').setDescription('模型名稱').setRequired(true)),

  new SlashCommandBuilder().setName('預設模型').setDescription('恢復為預設模型'),

  new SlashCommandBuilder().setName('重設').setDescription('重設上下文對話')
];

async function registerSlashCommands(clientId, token) {
  const { REST } = require('@discordjs/rest');
  const { Routes } = require('discord.js');
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: slashCommands.map(cmd => cmd.toJSON())
  });
  console.log('✅ GPT 指令已註冊');
}

async function handleSlash(interaction) {
  const userId = interaction.user.id;
  const channelId = interaction.channel.id;
  const currentModel = getUserModel(userId, channelId);
  if (!Object.keys(CHANNEL_MODEL_MAP).includes(channelId)) return;

  switch (interaction.commandName) {
    case '風格': {
      const style = interaction.options.getString('內容');
      userStyles.set(userId, style);
      return interaction.reply(`✅ 已為你設定風格為「${style}」。`);
    }
    case '正常風格': {
      userStyles.delete(userId);
      return interaction.reply('🧑‍💻 已恢復正常的說話風格。');
    }
    case '翻譯': {
      const text = interaction.options.getString('文字');
      const result = await openai.chat.completions.create({
        model: currentModel,
        messages: [
          { role: 'system', content: '你是一位翻譯家，請將以下內容翻譯成中文。' },
          { role: 'user', content: text }
        ]
      });
      return interaction.reply(`翻譯結果：\n${result.choices[0].message.content}`);
    }
    case '切換模型': {
      const model = interaction.options.getString('模型');
      userModels.set(userId, model);
      return interaction.reply(`✅ 模型已切換為 ${model}。`);
    }
    case '預設模型': {
      userModels.delete(userId);
      return interaction.reply(`✅ 已切換回預設模型：${CHANNEL_MODEL_MAP[channelId]}。`);
    }
    case '重設': {
      userSessions.delete(userId);
      return interaction.reply('🧹 上下文已重設。');
    }
  }
}

async function handleMessage(message) {
  if (message.author.bot) return;
  const channelId = message.channel.id;
  if (!Object.keys(CHANNEL_MODEL_MAP).includes(channelId)) return;

  const userId = message.author.id;
  const content = message.content.trim();
  const attachment = message.attachments.first();
  const currentModel = getUserModel(userId, channelId);

  if (attachment && attachment.contentType?.startsWith("image/") && content) {
    const thinkingMsg = await message.channel.send(`🖼️ 使用 ${currentModel} 分析圖片與問題中...`);
    try {
      const response = await openai.chat.completions.create({
        model: currentModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: content },
              { type: 'image_url', image_url: { url: attachment.url } }
            ]
          }
        ]
      });
      await thinkingMsg.delete();
      return await message.reply(`📷 分析結果：\n${response.choices[0].message.content}`);
    } catch (err) {
      console.error('圖片分析失敗：', err);
      await thinkingMsg.edit('❌ 分析圖片時發生錯誤。');
      return;
    }
  }

  const systemPrompt = getSystemPrompt(userId);
  const userContext = userSessions.get(userId) || [];
  userContext.push({ role: 'user', content });
  if (userContext.length > 6) userContext.shift();

  const messages = [{ role: 'system', content: systemPrompt }, ...userContext];
  const thinkingMessage = await message.channel.send('🤔 思考中...');

  try {
    const response = await openai.chat.completions.create({
      model: currentModel,
      messages,
      temperature: 0.7,
    });
    const answer = response.choices[0].message.content;
    userContext.push({ role: 'assistant', content: answer });
    userSessions.set(userId, userContext);
    await thinkingMessage.delete();
    const replyHeader = currentModel !== CHANNEL_MODEL_MAP[channelId]
      ? `💬 回覆(${currentModel})：` : '💬 回覆：';
    await message.channel.send(`${replyHeader}\n${answer}`);
  } catch (error) {
    console.error('GPT 錯誤：', error);
    await thinkingMessage.edit('❌ 發生錯誤，請稍後再試。');
  }
}

module.exports = {
  handleSlash,
  handleMessage,
  registerSlashCommands
};
