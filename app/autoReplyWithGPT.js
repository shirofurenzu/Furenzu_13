const { SlashCommandBuilder } = require('discord.js');
const OpenAI = require('openai');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config/aiBotConfig');
const AVAILABLE_MODELS = config.availableModels;


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
// 直接從設定檔讀取並轉換為 Map 格式
const CHANNEL_MODEL_MAP = {};
// 遍歷設定檔中的列表，自動建立映射
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
        throw new Error("無法處理圖片，請確認連結有效。");
    }
}

// --- 斜線指令定義 ---
const slashCommands = [
    new SlashCommandBuilder().setName('風格').setDescription('設定聊天風格')
        .addStringOption(opt => opt.setName('內容').setDescription('風格名稱').setRequired(true)),
    new SlashCommandBuilder().setName('正常風格').setDescription('清除自訂風格設定'),
    new SlashCommandBuilder().setName('翻譯').setDescription('將文字翻譯為指定語言(預設中文)')
        .addStringOption(opt => opt.setName('文字').setDescription('要翻譯的內容').setRequired(true))
        .addStringOption(opt => opt.setName('目標語言').setDescription('例如: 英文, 日文 (預設: 中文)').setRequired(false)),
    new SlashCommandBuilder().setName('切換模型').setDescription('切換你使用的 AI 模型')
        .addStringOption(opt =>
            opt.setName('模型')
                .setDescription('選擇一個 AI 模型')
                .setRequired(true)
                .addChoices(
                    ...AVAILABLE_MODELS.map(model => ({ name: model.name, value: model.value }))
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

    if (!currentModelInfo || !currentModelInfo.provider || !currentModelInfo.name) {
        return interaction.reply({ content: '❌ 未能確定當前 AI 模型設定，無法翻譯。請先嘗試 `/切換模型` 或確保此頻道已配置預設模型。', ephemeral: true });
    }
    if (currentModelInfo.provider === 'gemini' && !genAI) {
        return interaction.reply({ content: '❌ Gemini API 未正確初始化，無法使用 Gemini 模型進行翻譯。', ephemeral: true });
    }

    const translationSystemPrompt = `你是一位多語言翻譯專家，請將使用者提供的內容翻譯成「${targetLang}」。請只輸出翻譯結果，不要有任何額外的解釋或文字。`;
    await interaction.deferReply(); 

    try {
        let translatedText = "翻譯失敗，請稍後再試。";
        if (currentModelInfo.provider === 'openai') {
            const result = await openai.chat.completions.create({
                model: currentModelInfo.name,
                messages: [
                    { role: 'system', content: translationSystemPrompt },
                    { role: 'user', content: text }
                ]
            });
            translatedText = result.choices[0].message.content;
        } else if (currentModelInfo.provider === 'gemini') {
            const model = genAI.getGenerativeModel({
                model: currentModelInfo.name,
                systemInstruction: translationSystemPrompt,
            });
            const result = await model.generateContent(text);
            translatedText = result.response.text();
        }
        return interaction.editReply(`🌍 翻譯結果 (${targetLang} via ${currentModelInfo.provider}/${currentModelInfo.name})：\n${translatedText}`);
    } catch (error) {
        console.error(`翻譯時發生錯誤 (${currentModelInfo.provider}):`, error);
        return interaction.editReply(`❌ 翻譯過程中 (${currentModelInfo.provider}) 發生錯誤。`);
    }
}

async function handleSwitchModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id; 
    const modelValue = interaction.options.getString('模型');
    const parts = modelValue.split('/');

    if (parts.length === 2 && (parts[0] === 'openai' || parts[0] === 'gemini') && parts[1]) {
        const provider = parts[0];
        const name = parts[1];

        if (provider === 'gemini' && !genAI) {
            return interaction.reply({ content: '❌ Gemini API Key 未設定或初始化失敗，無法切換至 Gemini 模型。', ephemeral: true });
        }

        const channelUserModels = getChannelMap(userModelsByChannel, channelId);
        channelUserModels.set(userId, { provider, name });
        const selectedModelDisplayName = AVAILABLE_MODELS.find(m => m.value === modelValue)?.name || modelValue;
        return interaction.reply(`✅ 模型已為你在**本頻道**切換為 **${selectedModelDisplayName}**。`);
    } else {
        return interaction.reply({ content: '❌ 模型選擇無效。請從列表中選擇一個有效的模型。', ephemeral: true });
    }
}

async function handleDefaultModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const channelUserModels = getChannelMap(userModelsByChannel, channelId);
    channelUserModels.delete(userId); 
    const defaultModel = CHANNEL_MODEL_MAP[channelId]; 
    if (defaultModel) {
        return interaction.reply(`✅ 已為你在**本頻道**切換回此頻道的預設模型：${defaultModel.provider}/${defaultModel.name}。`);
    } else {
        return interaction.reply('✅ 你的個人模型設定已清除。此頻道未配置預設模型。');
    }
}

async function handleResetConversation(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const channelSessions = getChannelMap(userSessionsByChannel, channelId);
    channelSessions.delete(userId);
    return interaction.reply('🧹 **本頻道**上下文對話已為你重設。');
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
    if (handler) {
        await handler(interaction);
    } 
}

async function handleMessage(message) {
    if (message.author.bot) return;

    const userId = message.author.id;
    const channelId = message.channel.id;
    const content = message.content.trim();
    const attachment = message.attachments.first(); 

    // 使用重構後的 CHANNEL_MODEL_MAP 進行檢查
    if (!CHANNEL_MODEL_MAP[channelId]) {
        return; 
    }

    const currentModelInfo = getUserModel(userId, channelId); 

    if (!currentModelInfo || !currentModelInfo.provider || !currentModelInfo.name) {
        console.error(`在已設定頻道 ${channelId} 中無法確定模型資訊。請檢查環境變數配置。CurrentModelInfo:`, currentModelInfo);
        await message.reply("❌ 此頻道已設定為 AI 頻道，但模型配置似乎有誤。請聯繫管理員檢查機器人配置。");
        return;
    }

    if (currentModelInfo.provider === 'gemini' && !genAI) {
        await message.reply('❌ Gemini API Key 未設定或初始化失敗，無法使用 Gemini 模型。');
        return;
    }

    const systemPrompt = getSystemPrompt(userId, channelId); 

    if (attachment && attachment.contentType?.startsWith("image/")) {
        await handleImageMessage(message, currentModelInfo, systemPrompt, content, attachment);
    } else {
        await handleTextMessage(message, currentModelInfo, systemPrompt, content);
    }
}

async function handleImageMessage(message, currentModelInfo, systemPrompt, textContent, attachment) {
    let thinkingMsg;
    try {
        thinkingMsg = await message.channel.send(`🖼️ 使用 ${currentModelInfo.provider} (${currentModelInfo.name}) 分析圖片與問題中...`);

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
            const promptParts = [
                imagePart,
                { text: textContent || '請描述這張圖片。' } 
            ];

            const model = genAI.getGenerativeModel({
                model: currentModelInfo.name,
                systemInstruction: systemPrompt,
                safetySettings: [ 
                    {
                        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    },
                ],
            });
            const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }] });
            const responseText = result.response.text();
            await thinkingMsg.delete();
            await message.reply(`📷 Gemini (${currentModelInfo.name}) 分析結果：\n${responseText}`);
        }
    } catch (err) {
        console.error(`${currentModelInfo.provider} 圖片分析失敗：`, err);
        if (thinkingMsg) await thinkingMsg.edit(`❌ ${currentModelInfo.provider} 分析圖片時發生錯誤。`);
        else message.reply(`❌ ${currentModelInfo.provider} 分析圖片時發生錯誤。`);
    }
}

async function handleTextMessage(message, currentModelInfo, systemPrompt, content) {
    const userId = message.author.id;
    const channelId = message.channel.id;
    
    const channelSessions = getChannelMap(userSessionsByChannel, channelId);
    const userContext = channelSessions.get(userId) || []; 

    userContext.push({ role: 'user', content }); 
    if (userContext.length > CONTEXT_HISTORY_LIMIT) {
        userContext.splice(0, userContext.length - CONTEXT_HISTORY_LIMIT);
    }

    let thinkingMessage;
    try {
        thinkingMessage = await message.channel.send(`🤔 思考中 (${currentModelInfo.provider}: ${currentModelInfo.name})...`);
        let answer = '';

        if (currentModelInfo.provider === 'openai') {
            const messagesForOpenAI = [{ role: 'system', content: systemPrompt }, ...userContext];
            const response = await openai.chat.completions.create({
                model: currentModelInfo.name,
                messages: messagesForOpenAI,
                temperature: 1, 
            });
            answer = response.choices[0].message.content;
            } else if (currentModelInfo.provider === 'gemini') {
            const model = genAI.getGenerativeModel({
                model: currentModelInfo.name,
                systemInstruction: systemPrompt,
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                ],
            });

            const historyForGemini = [];
            const tempUserContext = [...userContext]; 
            const currentMessageContent = tempUserContext.pop().content; 

            while (tempUserContext.length > 0 && tempUserContext[0].role === 'assistant') {
                tempUserContext.shift(); 
            }

            for (const msg of tempUserContext) {
                historyForGemini.push({
                    role: msg.role === 'assistant' ? 'model' : 'user', 
                    parts: [{ text: msg.content }],
                });
            }
            
            const chat = model.startChat({ history: historyForGemini }); 
            const result = await chat.sendMessage(currentMessageContent); 
            answer = result.response.text();
        }

        userContext.push({ role: 'assistant', content: answer }); 
        channelSessions.set(userId, userContext); 

        if (thinkingMessage) await thinkingMessage.delete(); 

        const defaultChannelModel = CHANNEL_MODEL_MAP[channelId];
        let replyHeader = `💬 回覆 (${currentModelInfo.provider}/${currentModelInfo.name})：`;
        if (defaultChannelModel &&
            currentModelInfo.provider === defaultChannelModel.provider &&
            currentModelInfo.name === defaultChannelModel.name) {
            replyHeader = `💬 回覆 (${defaultChannelModel.provider}/${defaultChannelModel.name})：`;
        }
        
        const DISCORD_LIMIT = 1950;
        const header = `${replyHeader}\n`;
        let answerText = answer;
        let chunks = [];

        if (header.length + answerText.length <= DISCORD_LIMIT) {
            chunks.push(header + answerText);
        } else {
            let currIndex = 0;
            let firstChunkBodyLength = DISCORD_LIMIT - header.length;
            chunks.push(header + answerText.slice(0, firstChunkBodyLength));
            currIndex += firstChunkBodyLength;
            while (currIndex < answerText.length) {
                chunks.push(answerText.slice(currIndex, currIndex + DISCORD_LIMIT));
                currIndex += DISCORD_LIMIT;
            }
        }

        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }

    } catch (error) {
        console.error(`處理 ${currentModelInfo.provider} API 時發生錯誤:`, error);
        if (thinkingMessage) {
            await thinkingMessage.edit('❌ 發生錯誤，請稍後再試。');
        } else {
            await message.reply('❌ 處理你的請求時發生錯誤。');
        }
    }
}

module.exports = {
    handleSlash,
    handleMessage,
    registerSlashCommands,
    slashCommands 
};