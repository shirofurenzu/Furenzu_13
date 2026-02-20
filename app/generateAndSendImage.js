const { EmbedBuilder, AttachmentBuilder, Events, SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config/aiBotConfig'); 
const IMAGE_MODELS = config.imageModels;

// 初始化 OpenAI 客戶端
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// 初始化 Google Gemini 客戶端 (使用付費 Key 用於圖片生成)
const genAI = new GoogleGenerativeAI(config.gemini.apiKeyPaid);

// 使用者特定模型設定管理 Map<channelId, Map<userId, {provider, name, quality}>>
const userModelsByChannel = new Map();

/**
 * 輔助函式：取得使用者在該頻道的模型設定
 */
function getUserModel(userId, channelId) {
  if (!userModelsByChannel.has(channelId)) {
    userModelsByChannel.set(channelId, new Map());
  }
  
  const channelUserModels = userModelsByChannel.get(channelId);
  const userChoice = channelUserModels.get(userId);
  const defaultProvider = config.discord.imageChannelMap[channelId];

  if (userChoice) return userChoice;

  return { 
    provider: defaultProvider, 
    name: null, 
    quality: null 
  };
}

/**
 * 清理圖片生成指令
 */
function cleanPrompt(rawPrompt) {
  return rawPrompt.replace(/直圖|橫圖/g, '').trim();
}

/**
 * 檢測圖片尺寸
 */
function detectImageSize(prompt) {
  if (prompt.includes('直圖')) return config.openai.imageSize.vertical;
  if (prompt.includes('橫圖')) return config.openai.imageSize.horizontal;
  return config.openai.imageSize.default;
}

// --- 斜線指令定義 ---

const slashCommands = [
  new SlashCommandBuilder()
    .setName('切換繪圖模型')
    .setDescription('切換你在本頻道使用的繪圖模型與畫質')
    .addStringOption(opt =>
      opt.setName('設定')
        .setDescription('選擇模型與畫質組合')
        .setRequired(true)
        .addChoices(
          ...IMAGE_MODELS.map(model => ({ name: model.name, value: model.value }))
        )
    ),
  new SlashCommandBuilder()
    .setName('預設繪圖模型')
    .setDescription('恢復為本頻道的預設繪圖模型')
];

// --- 斜線指令處理器 ---

async function handleSlash(interaction) {
  const userId = interaction.user.id;
  const channelId = interaction.channel.id;

  if (interaction.commandName === '切換繪圖模型') {
    const value = interaction.options.getString('設定');
    const [providerInfo, qualityInfo] = value.split(':');
    const [provider, modelName] = providerInfo.split('/');
    const quality = qualityInfo === 'default' ? undefined : qualityInfo;

    if (!userModelsByChannel.has(channelId)) {
        userModelsByChannel.set(channelId, new Map());
    }
    userModelsByChannel.get(channelId).set(userId, { provider, name: modelName, quality });

    const displayName = IMAGE_MODELS.find(m => m.value === value)?.name || modelName;
    return interaction.reply(`✅ 繪圖模型已切換為：**${displayName}** (本頻道有效)`);
  }

  if (interaction.commandName === '預設繪圖模型') {
    if (userModelsByChannel.has(channelId)) {
      userModelsByChannel.get(channelId).delete(userId);
    }
    return interaction.reply('✅ 已恢復為此頻道的預設繪圖模型設定。');
  }
}

// --- 主程式邏輯 ---

async function generateAndSendImage(client) {
  if (!client.isReady()) {
    await new Promise(resolve => client.once(Events.ClientReady, resolve));
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const currentConfig = getUserModel(message.author.id, message.channel.id);
    const modelProvider = currentConfig.provider;
    
    if (!modelProvider) return; 

    const rawPrompt = message.content.trim();
    if (!rawPrompt) return;

    const prompt = cleanPrompt(rawPrompt);
    
    // 提前取得模型名稱，以便在提示訊息中顯示
    let generatorName = currentConfig.name || (modelProvider === 'openai' ? config.openai.imageModel : config.gemini.imageModel);
    
    // 將 generatorName 放入回覆訊息中
    const thinkingMsg = await message.reply(`🖌️ ${generatorName} 生成圖片中，請稍後...`);
    
    let imageUrl = '';
    let fileName = '';
    let attachment = null;
    let imageSize = '';
    let imageQuality = 'auto'; 
    let geminiResponseText = '';

    try {
      if (modelProvider === 'gemini') {
        // --- Gemini 處理邏輯 ---
        const geminiImageModel = genAI.getGenerativeModel({ model: generatorName });

        try {
          const result = await geminiImageModel.generateContent({
            contents: [{ role: "user", parts: [{ text: rawPrompt }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
          });

          const response = await result.response;
          let imageFound = false;

          for (const part of response.candidates[0].content.parts) {
            if (part.text) {
              geminiResponseText = part.text;
            } else if (part.inlineData) {
              const imageData = part.inlineData.data;
              const buffer = Buffer.from(imageData, 'base64');
              fileName = `gemini_image_${Date.now()}.png`;
              attachment = new AttachmentBuilder(buffer, { name: fileName });
              imageFound = true;
            }
          }

          if (!imageFound) {
            throw new Error('API 回應正常，但未包含圖片數據 (No image data in response)');
          }

        } catch (geminiError) {
          console.error('❌ Google Gemini 圖片生成錯誤:', geminiError);
          
          // 提取錯誤代碼與訊息
          const errStatus = geminiError.status || geminiError.code || 'Unknown Status';
          const errMessage = geminiError.message || JSON.stringify(geminiError);

          // 判斷是否為安全因素
          let friendlyMsg = '❌ Google Gemini 圖片生成失敗。';
          if (errMessage.includes('SAFETY') || errMessage.includes('blocked')) {
             friendlyMsg = '⚠️ 圖片生成失敗：內容可能涉及敏感話題而被 Google 攔截 (Safety Block)。';
          }

          // 顯示詳細錯誤資訊
          await thinkingMsg.edit(`${friendlyMsg}\n\n🛠️ **錯誤偵錯資訊：**\n\`\`\`json\nCode: ${errStatus}\nMessage: ${errMessage}\n\`\`\``);
          return;
        }

      } else if (modelProvider === 'openai') {
        // --- OpenAI 處理邏輯 ---
        const qualitySetting = currentConfig.quality || config.openai.imageQuality || 'standard';
        imageQuality = qualitySetting; 
        imageSize = detectImageSize(rawPrompt);

        const imageOptions = {
          model: generatorName,
          prompt,
          n: 1,
          size: imageSize,
          quality: imageQuality
        };

        const response = await openai.images.generate(imageOptions);
        
        const imageObj = response.data && response.data[0];
        
        if (imageObj && imageObj.url) {
          imageUrl = imageObj.url;
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          fileName = `openai_image_${Date.now()}.png`;
          attachment = new AttachmentBuilder(buffer, { name: fileName });
        } else if (imageObj && imageObj.b64_json) {
          const buffer = Buffer.from(imageObj.b64_json, 'base64');
          fileName = `openai_image_${Date.now()}.png`;
          attachment = new AttachmentBuilder(buffer, { name: fileName });
        } else {
          console.error('OpenAI 異常回應:', JSON.stringify(response, null, 2));
          throw new Error('OpenAI 未回傳有效的圖片 URL 或 Base64 數據');
        }

      } else {
        await thinkingMsg.edit('❌ 無法判斷圖片生成模型。');
        return;
      }

      // --- 建立回覆 ---
      const now = new Date();
      const timestamp = now.toLocaleString('zh-TW', { hour12: false });

      const embed = new EmbedBuilder()
        .setTitle('🎨 生成圖片結果')
        .setColor('#00bcd4')
        .addFields(
          { name: '原始 Prompt', value: rawPrompt },
          { name: '生成模型', value: generatorName },
          { name: '生成時間', value: timestamp }
        )
        .setFooter({ text: `由 ${generatorName} 自動生成` });

      if (modelProvider === 'gemini' && geminiResponseText) {
        embed.addFields({ name: '模型回覆', value: geminiResponseText.substring(0, 1024) });
      }

      if (modelProvider === 'openai') {
        if (imageSize && imageSize !== 'undefined') {
          embed.addFields({ name: '圖片尺寸', value: imageSize, inline: true });
        }
        if (imageQuality) {
          embed.addFields({ name: '畫質設定', value: imageQuality, inline: true });
        }
      }

      if (attachment) {
        await message.reply({ embeds: [embed], files: [attachment] });
      } else {
        await message.reply({ embeds: [embed] });
      }

      await thinkingMsg.delete();

    } catch (err) {
      // 全域錯誤處理
      console.error('❌ 生成圖片錯誤:', err);
      // 嘗試讀取 OpenAI 或其他 API 的回應錯誤內容
      const errDetail = err.response?.data?.error?.message || err.message || JSON.stringify(err);
      
      await thinkingMsg.edit(`❌ 系統發生錯誤，請稍後再試。\n\n🛠️ **錯誤詳細內容：**\n\`\`\`${errDetail}\`\`\``);
    }
  });
}

module.exports = {
  generateAndSendImage,
  handleSlash,
  slashCommands
};