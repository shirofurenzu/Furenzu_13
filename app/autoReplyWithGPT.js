const { SlashCommandBuilder } = require('discord.js');
const OpenAI = require('openai');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config/aiBotConfig');
const CHAT_MODELS = config.chatModels;

// --- 常數與初始化 ---
const DEFAULT_PERSONA = config.openai.persona;
const CONTEXT_HISTORY_LIMIT = 10; 

// 初始化 API 客戶端
const openai = new OpenAI({ apiKey: config.openai.apiKey });
let genAI;
if (config.gemini.apiKey) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
} else {
    console.warn("GEMINI_API_KEY 未設定，Gemini 功能將不可用。");
}

// 頻道與模型的映射關係
const CHANNEL_MODEL_MAP = {};
if (config.discord.chatChannelConfig && Array.isArray(config.discord.chatChannelConfig)) {
    config.discord.chatChannelConfig.forEach(channelCfg => {
        if (channelCfg.id && channelCfg.name) {
            CHANNEL_MODEL_MAP[channelCfg.id] = { 
                provider: channelCfg.provider, 
                name: channelCfg.name 
            };
        }
    });
}

// 使用者特定狀態管理
const userSessionsByChannel = new Map(); 
const userStylesByChannel = new Map();   
const userModelsByChannel = new Map();   

// --- 輔助函式 ---

function getChannelMap(parentMap, channelId) {
    if (!parentMap.has(channelId)) {
        parentMap.set(channelId, new Map());
    }
    return parentMap.get(channelId);
}

function getSystemPrompt(userId, channelId) {
    const channelStyles = getChannelMap(userStylesByChannel, channelId);
    const style = channelStyles.get(userId);
    return style ? `你是一個具備「${style}」風格的聊天助手，請用這種語氣回答使用者問題。` : DEFAULT_PERSONA;
}

function getUserModel(userId, channelId) {
    const channelUserModels = getChannelMap(userModelsByChannel, channelId);
    const userChoice = channelUserModels.get(userId);
    if (userChoice && typeof userChoice === 'object' && userChoice.provider && userChoice.name) {
        return userChoice;
    }
    return CHANNEL_MODEL_MAP[channelId]; 
}

async function urlToGenerativePart(url, mimeType) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(response.data).toString('base64');
        return { inlineData: { data: base64, mimeType } };
    } catch (error) {
        console.error("將 URL 轉換為 Generative Part 時發生錯誤:", error);
        throw new Error(`無法處理圖片，原因: ${error.message}`);
    }
}

// --- 斜線指令定義 ---
const slashCommands = [
    new SlashCommandBuilder().setName('風格').setDescription('設定聊天風格')
        .addStringOption(opt => opt.setName('內容').setDescription('風格名稱').setRequired(true)),
    new SlashCommandBuilder().setName('正常風格').setDescription('清除自訂風格設定'),
    new SlashCommandBuilder().setName('翻譯').setDescription('將文字翻譯為指定語言(預設台灣繁體中文)')
        .addStringOption(opt => opt.setName('文字').setDescription('要翻譯的內容').setRequired(true))
        .addStringOption(opt => opt.setName('目標語言').setDescription('例如: 英文, 日文 (預設: 台灣繁體中文)').setRequired(false)),
    new SlashCommandBuilder().setName('切換模型').setDescription('切換你使用的 AI 模型')
        .addStringOption(opt =>
            opt.setName('模型')
                .setDescription('選擇一個 AI 模型')
                .setRequired(true)
                .addChoices(
                    ...CHAT_MODELS.map(model => ({ name: model.name, value: model.value }))
                )
        ),
    new SlashCommandBuilder().setName('預設模型').setDescription('恢復為頻道的預設模型'),
    new SlashCommandBuilder().setName('重設').setDescription('重設上下文對話')
];

// --- 指令處理器 ---

async function handleSetStyle(interaction) {
    const style = interaction.options.getString('內容');
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const channelStyles = getChannelMap(userStylesByChannel, channelId);
    channelStyles.set(userId, style);
    return interaction.reply(`✅ 已為你在**本頻道**設定風格為「${style}」。`);
}

async function handleResetStyle(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const channelStyles = getChannelMap(userStylesByChannel, channelId);
    channelStyles.delete(userId);
    return interaction.reply('🧑‍💻 已在**本頻道**恢復正常的說話風格。');
}

async function handleTranslate(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const text = interaction.options.getString('文字');
    const targetLang = interaction.options.getString('目標語言') || '台灣繁體中文';

    const currentModelInfo = getUserModel(userId, channelId);
    if (!currentModelInfo) {
        return interaction.reply({ content: '❌ 未能確定當前 AI 模型設定，請先嘗試 `/切換模型`。', ephemeral: true });
    }
    
    await interaction.deferReply(); 

    try {
        let translatedText = "";
        if (currentModelInfo.provider === 'openai') {
            const result = await openai.chat.completions.create({
                model: currentModelInfo.name,
                messages: [
                    { role: 'system', content: `你是一位翻譯專家，請將內容翻譯成「${targetLang}」。請只輸出翻譯結果。` },
                    { role: 'user', content: text }
                ]
            });
            translatedText = result.choices[0].message.content;
        } else if (currentModelInfo.provider === 'gemini') {
            const model = genAI.getGenerativeModel({
                model: currentModelInfo.name,
                systemInstruction: `你是一位翻譯專家，請將內容翻譯成「${targetLang}」。請只輸出翻譯結果。`,
            });
            const result = await model.generateContent(text);
            translatedText = result.response.text();
        }
        return interaction.editReply(`🌍 翻譯結果 (${currentModelInfo.provider}: ${currentModelInfo.name})：\n${translatedText}`);
    } catch (error) {
        console.error(`翻譯錯誤:`, error);
        return interaction.editReply(`❌ 翻譯失敗 (${currentModelInfo.provider}: ${currentModelInfo.name})\n錯誤內容: ${error.message}${error.status ? ` (Status: ${error.status})` : ''}`);
    }
}

async function handleSwitchModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id; 
    const modelValue = interaction.options.getString('模型');
    const parts = modelValue.split('/');

    if (parts.length === 2) {
        const [provider, name] = parts;
        const channelUserModels = getChannelMap(userModelsByChannel, channelId);
        channelUserModels.set(userId, { provider, name });
        const displayName = CHAT_MODELS.find(m => m.value === modelValue)?.name || modelValue;
        return interaction.reply(`✅ 模型已為你在**本頻道**切換為 **${displayName}**。`);
    }
    return interaction.reply({ content: '❌ 模型選擇無效。', ephemeral: true });
}

async function handleDefaultModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const channelUserModels = getChannelMap(userModelsByChannel, channelId);
    channelUserModels.delete(userId); 
    return interaction.reply('✅ 已為你在**本頻道**恢復預設模型。');
}

async function handleResetConversation(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const channelSessions = getChannelMap(userSessionsByChannel, channelId);
    channelSessions.delete(userId);
    return interaction.reply('Sweep! 🧹 **本頻道**對話紀錄已重設。');
}

const slashCommandHandlers = {
    '風格': handleSetStyle,
    '正常風格': handleResetStyle,
    '翻譯': handleTranslate,
    '切換模型': handleSwitchModel,
    '預設模型': handleDefaultModel,
    '重設': handleResetConversation,
};

// --- 主要匯出函式 ---

async function registerSlashCommands(clientId, token) {
    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord.js');
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(clientId), {
            body: slashCommands.map(cmd => cmd.toJSON())
        });
        console.log('✅ GPT 與 Gemini 指令已註冊');
    } catch (error) {
        console.error("註冊斜線指令失敗:", error);
    }
}

async function handleSlash(interaction) {
    const handler = slashCommandHandlers[interaction.commandName];
    if (handler) await handler(interaction);
}

async function handleMessage(message) {
    if (message.author.bot) return;
    const channelId = message.channel.id;
    if (!CHANNEL_MODEL_MAP[channelId]) return;

    const userId = message.author.id;
    const currentModelInfo = getUserModel(userId, channelId);
    const systemPrompt = getSystemPrompt(userId, channelId); 
    const attachment = message.attachments.first();

    if (attachment && attachment.contentType?.startsWith("image/")) {
        await handleImageMessage(message, currentModelInfo, systemPrompt, message.content.trim(), attachment);
    } else {
        await handleTextMessage(message, currentModelInfo, systemPrompt, message.content.trim());
    }
}

async function handleImageMessage(message, currentModelInfo, systemPrompt, textContent, attachment) {
    let thinkingMsg;
    try {
        thinkingMsg = await message.channel.send(`🖼️ 分析圖片中 (${currentModelInfo.provider}: ${currentModelInfo.name})...`);

        if (currentModelInfo.provider === 'openai') {
            const response = await openai.chat.completions.create({
                model: currentModelInfo.name, 
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: textContent || '請描述這張圖片。' }, 
                        { type: 'image_url', image_url: { url: attachment.url } } 
                    ]
                }]
            });
            await thinkingMsg.delete();
            await message.reply(`📷 OpenAI (${currentModelInfo.name}) 分析結果：\n${response.choices[0].message.content}`);
        } else if (currentModelInfo.provider === 'gemini') {
            const imagePart = await urlToGenerativePart(attachment.url, attachment.contentType);
            const model = genAI.getGenerativeModel({ model: currentModelInfo.name, systemInstruction: systemPrompt });
            const result = await model.generateContent({ contents: [{ role: 'user', parts: [imagePart, { text: textContent || '請描述這張圖片。' }] }] });
            await thinkingMsg.delete();
            await message.reply(`📷 Gemini (${currentModelInfo.name}) 分析結果：\n${result.response.text()}`);
        }
    } catch (err) {
        console.error(`${currentModelInfo.provider} 圖片分析失敗：`, err);
        const errorDetail = `❌ ${currentModelInfo.provider}: ${currentModelInfo.name} 分析失敗\n🛠️ **錯誤詳細內容：**\n\`\`\` ${err.message}${err.status ? ` (Status: ${err.status})` : ''}\n\`\`\``;
        if (thinkingMsg) await thinkingMsg.edit(errorDetail);
        else message.reply(errorDetail);
    }
}

async function handleTextMessage(message, currentModelInfo, systemPrompt, content) {
    const userId = message.author.id;
    const channelId = message.channel.id;
    const channelSessions = getChannelMap(userSessionsByChannel, channelId);
    const userContext = channelSessions.get(userId) || []; 

    userContext.push({ role: 'user', content }); 
    if (userContext.length > CONTEXT_HISTORY_LIMIT) userContext.shift();

    let thinkingMessage;
    try {
        // 恢復顯示完整模型資訊
        thinkingMessage = await message.channel.send(`🤔 思考中 (${currentModelInfo.provider}: ${currentModelInfo.name})...`);
        let answer = '';

        if (currentModelInfo.provider === 'openai') {
            const response = await openai.chat.completions.create({
                model: currentModelInfo.name,
                messages: [{ role: 'system', content: systemPrompt }, ...userContext],
                temperature: 1, 
            });
            answer = response.choices[0].message.content;
        } else if (currentModelInfo.provider === 'gemini') {
            const model = genAI.getGenerativeModel({ model: currentModelInfo.name, systemInstruction: systemPrompt });
            const history = userContext.slice(0, -1).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user', 
                parts: [{ text: msg.content }],
            }));
            const chat = model.startChat({ history });
            const result = await chat.sendMessage(content); 
            answer = result.response.text();
        }

        userContext.push({ role: 'assistant', content: answer }); 
        channelSessions.set(userId, userContext); 

        if (thinkingMessage) await thinkingMessage.delete(); 

        const replyHeader = `💬 回覆 (${currentModelInfo.provider}: ${currentModelInfo.name})：\n`;
        const DISCORD_LIMIT = 1950;
        
        if (replyHeader.length + answer.length <= DISCORD_LIMIT) {
            await message.channel.send(replyHeader + answer);
        } else {
            // 分段發送，首段包含標頭
            await message.channel.send(replyHeader);
            for (let i = 0; i < answer.length; i += DISCORD_LIMIT) {
                await message.channel.send(answer.substring(i, i + DISCORD_LIMIT));
            }
        }

    } catch (error) {
        console.error(`對話錯誤:`, error);
        const errorDetail = `❌ ${currentModelInfo.provider}: ${currentModelInfo.name} 處理請求時發生錯誤\n🛠️ **錯誤詳細內容：**\n\`\`\` ${error.message}${error.status ? ` (Status: ${error.status})` : ''}\n\`\`\``;
        if (thinkingMessage) await thinkingMessage.edit(errorDetail);
        else await message.reply(errorDetail);
    }
}

module.exports = {
    handleSlash,
    handleMessage,
    registerSlashCommands,
    slashCommands 
};