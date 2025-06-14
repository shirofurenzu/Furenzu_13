const { SlashCommandBuilder } = require('discord.js');
const OpenAI = require('openai');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
// 引入 models.js 檔案中定義的模型列表
const { AVAILABLE_MODELS } = require('../config/models'); // 路徑已根據你的檔案結構調整

// --- 常數與初始化 ---
const DEFAULT_PERSONA = process.env.OPEN_AI_GPT_PERSONA || '你是一個樂於助人的助手，會簡潔地回答使用者的問題。';
const CONTEXT_HISTORY_LIMIT = 10; // 儲存對話歷史的數量 (5組對話，10條訊息)

// 初始化 API 客戶端
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });
let genAI;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
    console.warn("GEMINI_API_KEY 未設定，Gemini 功能將不可用。");
}

// 頻道與模型的映射關係
// 機器人只會在這些頻道中回應 AI 訊息
// provider: 'openai' 或 'gemini'
// name: 模型的具體名稱
const CHANNEL_MODEL_MAP = {};
// 建議：未來可考慮使用一個 JSON 環境變數來配置多個頻道，例如：
// DISCORD_CHANNEL_CONFIG='[{"id":"CHANNEL_ID_1","provider":"openai","model":"gpt-4o"},{"id":"CHANNEL_ID_2","provider":"gemini","model":"gemini-1.5-pro-latest"}]'
if (process.env.DISCORD_CHANNEL_ID && process.env.OPEN_AI_GPT_MODEL) {
    CHANNEL_MODEL_MAP[process.env.DISCORD_CHANNEL_ID] = { provider: 'openai', name: process.env.OPEN_AI_GPT_MODEL };
}
if (process.env.DISCORD_CHANNEL_ID2 && process.env.OPEN_AI_GPT_MODEL2) {
    CHANNEL_MODEL_MAP[process.env.DISCORD_CHANNEL_ID2] = { provider: 'openai', name: process.env.OPEN_AI_GPT_MODEL2 };
}
if (process.env.DISCORD_CHANNEL_ID4 && process.env.GOOGLE_GEMINI_MODEL) {
    CHANNEL_MODEL_MAP[process.env.DISCORD_CHANNEL_ID4] = { provider: 'gemini', name: process.env.GOOGLE_GEMINI_MODEL };
}

// 使用者特定狀態管理 - 關鍵修改：改為巢狀 Map，以支援每個頻道獨立設定
// outer Map key: channelId, inner Map key: userId
const userSessionsByChannel = new Map(); // 儲存對話歷史: channelId -> (userId -> [{ role, content }, ...])
const userStylesByChannel = new Map();   // 儲存使用者風格: channelId -> (userId -> styleString)
const userModelsByChannel = new Map();   // 儲存使用者選擇的模型: channelId -> (userId -> { provider, name })

// --- 輔助函式 ---

/**
 * 輔助函式：取得特定頻道的子 Map。如果不存在則會自動建立。
 * 這讓多頻道獨立設定的存取更方便。
 * @param {Map<string, Map<string, any>>} parentMap - 外層的 Map (例如 userStylesByChannel)。
 * @param {string} channelId - Discord 頻道的 ID。
 * @returns {Map<string, any>} - 該頻道的子 Map。
 */
function getChannelMap(parentMap, channelId) {
    if (!parentMap.has(channelId)) {
        parentMap.set(channelId, new Map());
    }
    return parentMap.get(channelId);
}

/**
 * 獲取給定使用者在特定頻道的系統提示詞。
 * 如果使用者在此頻道設定了個人風格，則返回帶有風格的提示詞；否則返回預設提示詞。
 * @param {string} userId - 使用者的 Discord ID。
 * @param {string} channelId - 訊息所在頻道的 Discord ID。
 * @returns {string} - 系統提示詞。
 */
function getSystemPrompt(userId, channelId) {
    // 從該頻道的風格 Map 中取得使用者風格
    const channelStyles = getChannelMap(userStylesByChannel, channelId);
    const style = channelStyles.get(userId);
    return style ? `你是一個具備「${style}」風格的聊天助手，請用這種語氣回答使用者問題。` : DEFAULT_PERSONA;
}

/**
 * 獲取給定使用者和頻道應使用的模型資訊。
 * 優先考慮使用者透過 `/切換模型` 指令為此頻道選擇的模型，其次是頻道的預設模型。
 * @param {string} userId - 使用者的 Discord ID。
 * @param {string} channelId - 訊息所在頻道的 Discord ID。
 * @returns {{provider: string, name: string} | undefined} - 模型提供者和名稱的物件，如果沒有設定則為 undefined。
 */
function getUserModel(userId, channelId) {
    // 從該頻道的模型 Map 中取得使用者模型
    const channelUserModels = getChannelMap(userModelsByChannel, channelId);
    const userChoice = channelUserModels.get(userId);
    if (userChoice && typeof userChoice === 'object' && userChoice.provider && userChoice.name) {
        return userChoice;
    }
    return CHANNEL_MODEL_MAP[channelId]; // 否則返回頻道的預設模型
}

/**
 * 將遠端圖片 URL 轉換為 GoogleGenerativeAI SDK 所需的 inlineData 部分（Base64 編碼）。
 * 這是為 Gemini 處理圖片所必需的步驟。
 * @param {string} url - 圖片的 URL。
 * @param {string} mimeType - 圖片的 MIME 類型 (例如, 'image/png')。
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>} - 包含 Base64 編碼圖片資料的物件。
 * @throws {Error} - 如果無法獲取或處理圖片。
 */
async function urlToGenerativePart(url, mimeType) {
    // 動態導入 node-fetch，因為它是 ES Module
    const { default: fetch } = await import('node-fetch');
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText} (Status: ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
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
                // 從 AVAILABLE_MODELS 引入選項，提供更好的使用者體驗
                .addChoices(
                    ...AVAILABLE_MODELS.map(model => ({ name: model.name, value: model.value }))
                )
        ),
    new SlashCommandBuilder().setName('預設模型').setDescription('恢復為頻道的預設模型'),
    new SlashCommandBuilder().setName('重設').setDescription('重設上下文對話')
];

// --- 指令處理器 ---

/**
 * 處理 `/風格` 指令，設定使用者在**當前頻道**的聊天風格。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleSetStyle(interaction) {
    const style = interaction.options.getString('內容');
    const userId = interaction.user.id;
    const channelId = interaction.channel.id; // 取得頻道 ID

    // 取得或建立該頻道的風格 Map，然後設定此使用者在此頻道的風格
    const channelStyles = getChannelMap(userStylesByChannel, channelId);
    channelStyles.set(userId, style);
    return interaction.reply(`✅ 已為你在**本頻道**設定風格為「${style}」。`);
}

/**
 * 處理 `/正常風格` 指令，清除使用者在**當前頻道**的自訂風格設定。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleResetStyle(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;

    // 從該頻道的風格 Map 中清除此使用者風格
    const channelStyles = getChannelMap(userStylesByChannel, channelId);
    channelStyles.delete(userId);
    return interaction.reply('🧑‍💻 已在**本頻道**恢復正常的說話風格。');
}

/**
 * 處理 `/翻譯` 指令，將文字翻譯為指定語言。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleTranslate(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const text = interaction.options.getString('文字');
    const targetLang = interaction.options.getString('目標語言') || '台灣繁體中文';

    // 獲取使用者在當前頻道應使用的模型資訊
    const currentModelInfo = getUserModel(userId, channelId);

    // 斜線指令可以在任何頻道使用，但模型翻譯仍需依賴模型設定
    if (!currentModelInfo || !currentModelInfo.provider || !currentModelInfo.name) {
        return interaction.reply({ content: '❌ 未能確定當前 AI 模型設定，無法翻譯。請先嘗試 `/切換模型` 或確保此頻道已配置預設模型。', ephemeral: true });
    }
    if (currentModelInfo.provider === 'gemini' && !genAI) {
        return interaction.reply({ content: '❌ Gemini API 未正確初始化，無法使用 Gemini 模型進行翻譯。', ephemeral: true });
    }

    const translationSystemPrompt = `你是一位多語言翻譯專家，請將使用者提供的內容翻譯成「${targetLang}」。請只輸出翻譯結果，不要有任何額外的解釋或文字。`;
    await interaction.deferReply(); // 延遲回覆，給予足夠時間處理

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

/**
 * 處理 `/切換模型` 指令，讓使用者選擇不同的 AI 模型，**只針對當前頻道生效**。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleSwitchModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id; // 取得頻道 ID
    // 直接取得選項的值，這個值已經是 'provider/name' 格式
    const modelValue = interaction.options.getString('模型');
    const parts = modelValue.split('/');

    if (parts.length === 2 && (parts[0] === 'openai' || parts[0] === 'gemini') && parts[1]) {
        const provider = parts[0];
        const name = parts[1];

        // 檢查 Gemini API 是否已初始化，如果選擇了 Gemini 模型
        if (provider === 'gemini' && !genAI) {
            return interaction.reply({ content: '❌ Gemini API Key 未設定或初始化失敗，無法切換至 Gemini 模型。', ephemeral: true });
        }

        // 取得或建立該頻道的模型 Map，然後設定此使用者在此頻道的模型
        const channelUserModels = getChannelMap(userModelsByChannel, channelId);
        channelUserModels.set(userId, { provider, name });
        // 查找使用者選擇的模型的顯示名稱，用於回覆訊息，提升使用者體驗
        const selectedModelDisplayName = AVAILABLE_MODELS.find(m => m.value === modelValue)?.name || modelValue;
        return interaction.reply(`✅ 模型已為你在**本頻道**切換為 **${selectedModelDisplayName}**。`);
    } else {
        // 理論上，如果選項是預定義的，這個錯誤訊息不應該觸發。
        // 這作為一個防禦性編程措施，以防未來有其他非預期值傳入。
        return interaction.reply({ content: '❌ 模型選擇無效。請從列表中選擇一個有效的模型。', ephemeral: true });
    }
}

/**
 * 處理 `/預設模型` 指令，將使用者使用的模型恢復為**當前頻道**的預設模型。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleDefaultModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;

    // 從該頻道的模型 Map 中清除此使用者模型設定
    const channelUserModels = getChannelMap(userModelsByChannel, channelId);
    channelUserModels.delete(userId); // 清除使用者個人模型設定
    const defaultModel = CHANNEL_MODEL_MAP[channelId]; // 獲取頻道的預設模型資訊
    if (defaultModel) {
        return interaction.reply(`✅ 已為你在**本頻道**切換回此頻道的預設模型：${defaultModel.provider}/${defaultModel.name}。`);
    } else {
        return interaction.reply('✅ 你的個人模型設定已清除。此頻道未配置預設模型。');
    }
}

/**
 * 處理 `/重設` 指令，清除使用者在**當前頻道**的對話上下文。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleResetConversation(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;

    // 從該頻道的對話歷史 Map 中清除此使用者的對話歷史
    const channelSessions = getChannelMap(userSessionsByChannel, channelId);
    channelSessions.delete(userId);
    return interaction.reply('🧹 **本頻道**上下文對話已為你重設。');
}

// 將斜線指令名稱映射到對應的處理器函式
const slashCommandHandlers = {
    '風格': handleSetStyle,
    '正常風格': handleResetStyle,
    '翻譯': handleTranslate,
    '切換模型': handleSwitchModel,
    '預設模型': handleDefaultModel,
    '重設': handleResetConversation,
};

// --- 主要匯出函式 ---

/**
 * 向 Discord 註冊斜線指令。
 * 此函式應在機器人啟動時呼叫一次。
 * @param {string} clientId - 你的 Discord 應用程式 ID。
 * @param {string} token - 你的 Discord 機器人 Token。
 */
async function registerSlashCommands(clientId, token) {
    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord.js');
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        // 向 Discord API 發送所有斜線指令的 JSON 表示
        await rest.put(Routes.applicationCommands(clientId), {
            body: slashCommands.map(cmd => cmd.toJSON())
        });
        console.log('✅ GPT 與 Gemini 指令已註冊');
    } catch (error) {
        console.error("註冊斜線指令失敗:", error);
    }
}

/**
 * 處理傳入的斜線指令。
 * 根據指令名稱呼叫對應的處理器函式。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleSlash(interaction) {
    const handler = slashCommandHandlers[interaction.commandName];
    if (handler) {
        await handler(interaction);
    } 
}

/**
 * 處理傳入的 Discord 訊息。
 * 判斷是普通文字訊息還是帶圖片的訊息，並呼叫對應的處理函式。
 * @param {import('discord.js').Message} message - Discord 訊息物件。
 */
async function handleMessage(message) {
    // 忽略機器人自己的訊息
    if (message.author.bot) return;

    const userId = message.author.id;
    const channelId = message.channel.id;
    const content = message.content.trim();
    const attachment = message.attachments.first(); // 獲取第一個附件

    // 檢查當前頻道是否在 CHANNEL_MODEL_MAP 中有設定
    // 如果不在設定的頻道列表裡，則直接忽略此訊息，不進行任何 AI 處理或回覆。
    if (!CHANNEL_MODEL_MAP[channelId]) {
        // console.log(`頻道 ${channelId} 未設定 AI 模型，忽略訊息。`); // 可以取消註解用於調試
        return; // 直接退出，不處理此頻道的消息
    }

    // 獲取使用者在當前頻道應使用的模型資訊
    const currentModelInfo = getUserModel(userId, channelId); 

    // 如果在已設定的頻道中，但透過 getUserModel 仍未獲取到有效模型 (例如，環境變數配置錯誤)，
    // 則會執行這裡的邏輯。
    if (!currentModelInfo || !currentModelInfo.provider || !currentModelInfo.name) {
        console.error(`在已設定頻道 ${channelId} 中無法確定模型資訊。請檢查環境變數配置。CurrentModelInfo:`, currentModelInfo);
        await message.reply("❌ 此頻道已設定為 AI 頻道，但模型配置似乎有誤。請聯繫管理員檢查機器人配置。");
        return;
    }

    // 如果選擇了 Gemini 模型但 API 未初始化，則提示錯誤
    if (currentModelInfo.provider === 'gemini' && !genAI) {
        await message.reply('❌ Gemini API Key 未設定或初始化失敗，無法使用 Gemini 模型。');
        return;
    }

    // 獲取使用者在當前頻道的系統提示詞
    const systemPrompt = getSystemPrompt(userId, channelId); 

    // 處理帶有圖片附件的訊息
    if (attachment && attachment.contentType?.startsWith("image/")) {
        await handleImageMessage(message, currentModelInfo, systemPrompt, content, attachment);
    } else {
        // 處理純文字訊息
        await handleTextMessage(message, currentModelInfo, systemPrompt, content);
    }
}

/**
 * 處理帶有圖片附件的訊息。
 * 根據當前模型提供者（OpenAI 或 Gemini）呼叫相應的視覺 API。
 * @param {import('discord.js').Message} message - Discord 訊息物件。
 * @param {{provider: string, name: string}} currentModelInfo - 當前使用的模型資訊。
 * @param {string} systemPrompt - 系統提示詞。
 * @param {string} textContent - 圖片附帶的文字內容。
 * @param {import('discord.js').Attachment} attachment - Discord 附件物件。
 */
async function handleImageMessage(message, currentModelInfo, systemPrompt, textContent, attachment) {
    let thinkingMsg;
    try {
        thinkingMsg = await message.channel.send(`🖼️ 使用 ${currentModelInfo.provider} (${currentModelInfo.name}) 分析圖片與問題中...`);

        if (currentModelInfo.provider === 'openai') {
            // OpenAI 視覺模型 (例如 gpt-4o, gpt-4-turbo)
            const response = await openai.chat.completions.create({
                model: currentModelInfo.name, // 確保此模型支援視覺功能
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: textContent || '請描述這張圖片。' }, // 如果沒有文字，則要求描述圖片
                        { type: 'image_url', image_url: { url: attachment.url } } // 傳遞圖片 URL
                    ]
                }]
            });
            await thinkingMsg.delete();
            await message.reply(`📷 OpenAI (${currentModelInfo.name}) 分析結果：\n${response.choices[0].message.content}`);
        } else if (currentModelInfo.provider === 'gemini') {
            // Gemini 視覺模型 (例如 gemini-1.5-pro-latest, gemini-1.5-flash-latest)
            // 需要將圖片 URL 轉換為 Generative Part (Base64 編碼)
            const imagePart = await urlToGenerativePart(attachment.url, attachment.contentType);
            const promptParts = [
                imagePart,
                { text: textContent || '請描述這張圖片。' } // 文字部分
            ];

            const model = genAI.getGenerativeModel({
                model: currentModelInfo.name,
                systemInstruction: systemPrompt,
                safetySettings: [ // Gemini 的安全設定範例，可根據需求調整
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
            // 呼叫 Gemini API 進行多模態內容生成
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

/**
 * 處理純文字訊息。
 * 根據當前模型提供者（OpenAI 或 Gemini）呼叫相應的文字生成 API。
 * 管理對話上下文，**對話歷史在每個頻道是獨立的**。
 * @param {import('discord.js').Message} message - Discord 訊息物件。
 * @param {{provider: string, name: string}} currentModelInfo - 當前使用的模型資訊。
 * @param {string} systemPrompt - 系統提示詞。
 * @param {string} content - 文字訊息內容。
 */
async function handleTextMessage(message, currentModelInfo, systemPrompt, content) {
    const userId = message.author.id;
    const channelId = message.channel.id;
    
    // 取得或建立該頻道的對話歷史 Map，然後從中獲取使用者在此頻道的對話歷史
    const channelSessions = getChannelMap(userSessionsByChannel, channelId);
    const userContext = channelSessions.get(userId) || []; 

    userContext.push({ role: 'user', content }); // 添加最新使用者訊息
    // 限制對話歷史長度，保留最近的 N 條訊息（例如 5組對話，共 10 條訊息）
    if (userContext.length > CONTEXT_HISTORY_LIMIT) {
        userContext.splice(0, userContext.length - CONTEXT_HISTORY_LIMIT);
    }

    let thinkingMessage;
    try {
        thinkingMessage = await message.channel.send(`🤔 思考中 (${currentModelInfo.provider}: ${currentModelInfo.name})...`);
        let answer = '';

        if (currentModelInfo.provider === 'openai') {
            // 為 OpenAI 準備訊息格式：系統提示詞 + 對話歷史
            const messagesForOpenAI = [{ role: 'system', content: systemPrompt }, ...userContext];
            const response = await openai.chat.completions.create({
                model: currentModelInfo.name,
                messages: messagesForOpenAI,
                temperature: 0.7, // 控制生成文本的隨機性
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

            // 關鍵修改：為 Gemini 構建正確的對話歷史格式，確保第一條是 'user'
            const historyForGemini = [];
            // 只將對話歷史中除了最新一條「user」訊息以外的內容加入歷史
            // Gemini 的 chat.sendMessage() 會處理當前這一條使用者訊息
            
            // 複製一份 userContext，避免直接修改原始陣列用於後續判斷
            const tempUserContext = [...userContext]; 
            // 獲取當前使用者發送的最新訊息內容，並從臨時歷史中移除
            const currentMessageContent = tempUserContext.pop().content; 

            // 調整歷史紀錄，確保第一條是 'user'
            // 循環移除開頭為 'assistant' (在 Gemini 中為 'model') 的訊息，直到第一條是 'user'
            while (tempUserContext.length > 0 && tempUserContext[0].role === 'assistant') {
                tempUserContext.shift(); // 移除最舊的訊息
            }

            // 將處理過後的歷史紀錄轉換為 Gemini 期望的格式
            for (const msg of tempUserContext) {
                historyForGemini.push({
                    role: msg.role === 'assistant' ? 'model' : 'user', // 將 OpenAI 的 'assistant' 轉換為 Gemini 的 'model'
                    parts: [{ text: msg.content }],
                });
            }
            
            // Debugging 輸出，可以幫助您檢查歷史內容
            // console.log("Gemini History being sent:", JSON.stringify(historyForGemini, null, 2));


            const chat = model.startChat({ history: historyForGemini }); // 使用修正後的歷史
            const result = await chat.sendMessage(currentMessageContent); // 發送最新使用者訊息
            answer = result.response.text();
        }

        userContext.push({ role: 'assistant', content: answer }); // 將 AI 回覆添加到對話歷史
        // 更新使用者在此頻道的對話歷史
        channelSessions.set(userId, userContext); 

        if (thinkingMessage) await thinkingMessage.delete(); // 刪除「思考中」訊息

        // 構建回覆訊息標題，顯示當前使用的模型資訊
        const defaultChannelModel = CHANNEL_MODEL_MAP[channelId];
        let replyHeader = `💬 回覆 (${currentModelInfo.provider}/${currentModelInfo.name})：`;
        // 如果使用者使用頻道的預設模型，則可以簡化標題
        if (defaultChannelModel &&
            currentModelInfo.provider === defaultChannelModel.provider &&
            currentModelInfo.name === defaultChannelModel.name) {
            replyHeader = `💬 回覆 (${defaultChannelModel.provider}/${defaultChannelModel.name})：`;
        }
        // 分段傳送，單段最多1950字元
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
    slashCommands // 導出指令定義，以便主文件可能需要
};