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
if (process.env.DISCORD_CHANNEL_ID && process.env.OPEN_AI_GPT_MODEL) {
    CHANNEL_MODEL_MAP[process.env.DISCORD_CHANNEL_ID] = { provider: 'openai', name: process.env.OPEN_AI_GPT_MODEL };
}
if (process.env.DISCORD_CHANNEL_ID2 && process.env.OPEN_AI_GPT_MODEL2) {
    CHANNEL_MODEL_MAP[process.env.DISCORD_CHANNEL_ID2] = { provider: 'openai', name: process.env.OPEN_AI_GPT_MODEL2 };
}
if (process.env.DISCORD_CHANNEL_ID4 && process.env.GOOGLE_GEMINI_MODEL) {
    CHANNEL_MODEL_MAP[process.env.DISCORD_CHANNEL_ID4] = { provider: 'gemini', name: process.env.GOOGLE_GEMINI_MODEL };
}

// 使用者特定狀態管理
const userSessions = new Map(); // 儲存對話歷史: userId -> [{ role, content }, ...]
const userStyles = new Map();   // 儲存使用者風格: userId -> styleString
const userModels = new Map();   // 儲存使用者選擇的模型: userId -> { provider, name }

// --- 輔助函式 ---

/**
 * 獲取給定使用者的系統提示詞。
 * 如果使用者設定了個人風格，則返回帶有風格的提示詞；否則返回預設提示詞。
 * @param {string} userId - 使用者的 Discord ID。
 * @returns {string} - 系統提示詞。
 */
function getSystemPrompt(userId) {
    const style = userStyles.get(userId);
    return style ? `你是一個具備「${style}」風格的聊天助手，請用這種語氣回答使用者問題。` : DEFAULT_PERSONA;
}

/**
 * 獲取給定使用者和頻道應使用的模型資訊。
 * 優先考慮使用者透過 `/切換模型` 指令選擇的模型，其次是頻道的預設模型。
 * @param {string} userId - 使用者的 Discord ID。
 * @param {string} channelId - 訊息所在頻道的 Discord ID。
 * @returns {{provider: string, name: string} | undefined} - 模型提供者和名稱的物件，如果沒有設定則為 undefined。
 */
function getUserModel(userId, channelId) {
    const userChoice = userModels.get(userId);
    if (userChoice && typeof userChoice === 'object' && userChoice.provider && userChoice.name) {
        return userChoice;
    }
    return CHANNEL_MODEL_MAP[channelId];
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
            throw new Error(`Failed to fetch image: ${response.statusText}`);
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
 * 處理 `/風格` 指令，設定使用者聊天風格。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleSetStyle(interaction) {
    const style = interaction.options.getString('內容');
    userStyles.set(interaction.user.id, style);
    return interaction.reply(`✅ 已為你設定風格為「${style}」。`);
}

/**
 * 處理 `/正常風格` 指令，清除使用者自訂風格設定。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleResetStyle(interaction) {
    userStyles.delete(interaction.user.id);
    return interaction.reply('🧑‍💻 已恢復正常的說話風格。');
}

/**
 * 處理 `/翻譯` 指令，將文字翻譯為指定語言。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleTranslate(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const text = interaction.options.getString('文字');
<<<<<<< HEAD
    const targetLang = interaction.options.getString('目標語言') || '台灣繁體中文';
=======
    const targetLang = interaction.options.getString('目標語言') || '中文';
>>>>>>> b96f0b64248a58849c1d017e1b3acf81a8cc9d8e
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
 * 處理 `/切換模型` 指令，讓使用者選擇不同的 AI 模型。
 * 使用者現在透過選單選擇模型，而不是手動輸入。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleSwitchModel(interaction) {
    const userId = interaction.user.id;
    // 直接取得選項的值，這個值已經是 'provider/name' 格式
    const modelValue = interaction.options.getString('模型');
    const parts = modelValue.split('/');

    // 由於模型是從預定義的列表選擇的，這裡的驗證會更簡單，但也保留了防禦性檢查。
    if (parts.length === 2 && (parts[0] === 'openai' || parts[0] === 'gemini') && parts[1]) {
        const provider = parts[0];
        const name = parts[1];

        // 檢查 Gemini API 是否已初始化，如果選擇了 Gemini 模型
        if (provider === 'gemini' && !genAI) {
            return interaction.reply({ content: '❌ Gemini API Key 未設定或初始化失敗，無法切換至 Gemini 模型。', ephemeral: true });
        }

        userModels.set(userId, { provider, name });
        // 查找使用者選擇的模型的顯示名稱，用於回覆訊息，提升使用者體驗
        const selectedModelDisplayName = AVAILABLE_MODELS.find(m => m.value === modelValue)?.name || modelValue;
        return interaction.reply(`✅ 模型已為你切換為 **${selectedModelDisplayName}**。`);
    } else {
        // 理論上，如果選項是預定義的，這個錯誤訊息不應該觸發。
        // 這作為一個防禦性編程措施，以防未來有其他非預期值傳入。
        return interaction.reply({ content: '❌ 模型選擇無效。請從列表中選擇一個有效的模型。', ephemeral: true });
    }
}

/**
 * 處理 `/預設模型` 指令，將使用者使用的模型恢復為頻道的預設模型。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleDefaultModel(interaction) {
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    userModels.delete(userId); // 清除使用者個人模型設定
    const defaultModel = CHANNEL_MODEL_MAP[channelId]; // 獲取頻道的預設模型資訊
    if (defaultModel) {
        return interaction.reply(`✅ 已為你切換回此頻道的預設模型：${defaultModel.provider}/${defaultModel.name}。`);
    } else {
        return interaction.reply('✅ 你的個人模型設定已清除。此頻道未配置預設模型。');
    }
}

/**
 * 處理 `/重設` 指令，清除使用者當前的對話上下文。
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord 互動物件。
 */
async function handleResetConversation(interaction) {
    userSessions.delete(interaction.user.id); // 清除該使用者的對話歷史
    return interaction.reply('🧹 上下文對話已為你重設。');
}

// 將斜線指令名稱映射到對應的處理器函式
const slashCommandHandlers = {
    '風格': handleSetStyle,
    '正常風格': handleResetStyle,
    '翻譯': handleTranslate,
    '切換模型': handleSwitchModel, // 確保這裡指向更新後的函式
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

    // *** 關鍵修改部分 START ***
    // 檢查當前頻道是否在 CHANNEL_MODEL_MAP 中有設定
    // 如果不在設定的頻道列表裡，則直接忽略此訊息，不進行任何 AI 處理或回覆。
    if (!CHANNEL_MODEL_MAP[channelId]) {
        // console.log(`頻道 ${channelId} 未設定 AI 模型，忽略訊息。`); // 可以取消註解用於調試
        return; // 直接退出，不處理此頻道的消息
    }
    // *** 關鍵修改部分 END ***

    const currentModelInfo = getUserModel(userId, channelId); // 獲取當前模型資訊

    // 檢查是否有有效的模型設定（這段現在只會在已設定的頻道中執行）
    // 如果在已設定的頻道中，但透過 getUserModel 仍未獲取到有效模型 (例如，環境變數配置錯誤)，
    // 則會執行這裡的邏輯。
    if (!currentModelInfo || !currentModelInfo.provider || !currentModelInfo.name) {
        console.error(`在已設定頻道 ${channelId} 中無法確定模型資訊。請檢查環境變數配置。CurrentModelInfo:`, currentModelInfo);
        // 這裡可以選擇是否給使用者一個錯誤回覆，或者直接靜默處理
        await message.reply("❌ 此頻道已設定為 AI 頻道，但模型配置似乎有誤。請聯繫管理員檢查機器人配置。");
        return;
    }

    // 如果選擇了 Gemini 模型但 API 未初始化，則提示錯誤
    if (currentModelInfo.provider === 'gemini' && !genAI) {
        await message.reply('❌ Gemini API Key 未設定或初始化失敗，無法使用 Gemini 模型。');
        return;
    }

    const systemPrompt = getSystemPrompt(userId); // 獲取系統提示詞

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
 * 管理對話上下文。
 * @param {import('discord.js').Message} message - Discord 訊息物件。
 * @param {{provider: string, name: string}} currentModelInfo - 當前使用的模型資訊。
 * @param {string} systemPrompt - 系統提示詞。
 * @param {string} content - 文字訊息內容。
 */
async function handleTextMessage(message, currentModelInfo, systemPrompt, content) {
    const userId = message.author.id;
    const channelId = message.channel.id;
    const userContext = userSessions.get(userId) || []; // 獲取使用者對話歷史

    userContext.push({ role: 'user', content }); // 添加最新使用者訊息
    // 限制對話歷史長度，保留最近的 N 條訊息（例如 5 組對話，共 10 條訊息）
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
<<<<<<< HEAD
        }  else if (currentModelInfo.provider === 'gemini') {
    const model = genAI.getGenerativeModel({
        model: currentModelInfo.name,
        systemInstruction: systemPrompt,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
    });

    // 關鍵修改：確保歷史的起始角色正確
    const historyForGemini = [];
    let foundFirstUser = false; // 標記是否找到第一個使用者訊息

    // 遍歷 userContext，從第一個 user 訊息開始構建歷史
    for (const msg of userContext) {
        // 如果還沒有找到第一個 'user' 訊息，並且當前訊息是 'model'，則跳過
        if (!foundFirstUser && msg.role === 'assistant') { // 注意：你的 assistant 角色在 Gemini 裡會變成 model
            continue;
        }
        // 找到第一個 'user' 訊息後，或者已經開始添加訊息後，就開始添加
        if (msg.role === 'user') {
            foundFirstUser = true;
        }
        
        // 將訊息添加到歷史中，並轉換角色
        historyForGemini.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        });
    }

    // 處理當前使用者訊息 (userContext 中的最後一條)
    // 如果 historyForGemini 中包含當前使用者訊息，則移除它，因為 sendMessage 處理它
    let currentMessageForSend = '';
    if (historyForGemini.length > 0 && historyForGemini[historyForGemini.length - 1].role === 'user') {
        currentMessageForSend = historyForGemini.pop().parts[0].text; // 移除並獲取最後一條使用者訊息
    } else {
        // 這應該不會發生，因為 userContext.push({ role: 'user', content }); 總會把當前訊息加進去
        currentMessageForSend = content; // 或者直接使用傳入的 content
    }


    const chat = model.startChat({ history: historyForGemini }); // 使用修正後的歷史
    const result = await chat.sendMessage(currentMessageForSend); // 發送最新使用者訊息
    answer = result.response.text();
}
=======
        } else if (currentModelInfo.provider === 'gemini') {
            const model = genAI.getGenerativeModel({
                model: currentModelInfo.name,
                systemInstruction: systemPrompt, // 系統提示詞
                safetySettings: [ // Gemini 的安全設定範例
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

            // 為 Gemini 準備聊天歷史：需要將角色映射（assistant -> model）並包裝在 'parts' 中
            const historyForGemini = userContext.slice(0, -1).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));
            const latestUserMessageContent = userContext[userContext.length - 1].content; // 最後一條是當前的使用者訊息

            const chat = model.startChat({ history: historyForGemini }); // 開始聊天會話，帶入歷史
            const result = await chat.sendMessage(latestUserMessageContent); // 發送最新使用者訊息
            answer = result.response.text();
        }
>>>>>>> b96f0b64248a58849c1d017e1b3acf81a8cc9d8e

        userContext.push({ role: 'assistant', content: answer }); // 將 AI 回覆添加到對話歷史
        userSessions.set(userId, userContext); // 更新使用者對話歷史

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
<<<<<<< HEAD
};
=======
};
>>>>>>> b96f0b64248a58849c1d017e1b3acf81a8cc9d8e
