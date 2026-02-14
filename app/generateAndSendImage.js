const { EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config/aiBotConfig'); 

// 初始化 OpenAI 客戶端
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// 初始化 Google Gemini 客戶端 (使用付費 Key 用於圖片生成)
const genAI = new GoogleGenerativeAI(config.gemini.apiKeyPaid);
const geminiImageModel = genAI.getGenerativeModel({ model: config.gemini.imageModel });

/**
 * 清理圖片生成指令，移除尺寸關鍵字。
 * @param {string} rawPrompt 原始指令。
 * @returns {string} 清理後的指令。
 */
function cleanPrompt(rawPrompt) {
  return rawPrompt.replace(/直圖|橫圖/g, '').trim();
}

/**
 * 根據指令檢測圖片尺寸。
 * @param {string} prompt 原始指令。
 * @returns {string} 對應的圖片尺寸。
 */
function detectImageSize(prompt) {
  if (prompt.includes('直圖')) return config.openai.imageSize.vertical;
  if (prompt.includes('橫圖')) return config.openai.imageSize.horizontal;
  return config.openai.imageSize.default;
}

/**
 * 生成並發送圖片到 Discord 頻道。
 * 根據設定檔中的映射決定使用哪個模型。
 * @param {Client} client Discord 客戶端實例。
 */
async function generateAndSendImage(client) {
  if (!client.isReady()) {
    await new Promise(resolve => client.once(Events.ClientReady, resolve));
  }
  
  // 使用 config 中的映射
  const channelModelMap = config.discord.imageChannelMap;

  client.on('messageCreate', async (message) => {
    // 檢查頻道是否在設定中
    const modelToUse = channelModelMap[message.channel.id];
    if (!modelToUse) return; 

    if (message.author.bot) return;

    const rawPrompt = message.content.trim();
    if (!rawPrompt) return;

    const thinkingMsg = await message.reply('🖌️ 生成圖片中，請稍後...');
    const prompt = cleanPrompt(rawPrompt);
    let imageUrl = '';
    let generatorName = '';
    let fileName = '';
    let attachment = null;
    let imageSize = '';
    let imageQuality = 'auto'; 
    let geminiResponseText = '';

    try {
      if (modelToUse === 'gemini') {
        // 使用 Google Gemini 生成圖片
        generatorName = config.gemini.imageModel;
        try {
          const geminiPrompt = rawPrompt;

          const result = await geminiImageModel.generateContent({
            contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
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
            throw new Error('Gemini 沒有返回圖片數據。');
          }

        } catch (geminiError) {
          console.error('❌ Google Gemini 圖片生成錯誤:', geminiError);
          if (geminiError.message && geminiError.message.includes('safety')) {
            await thinkingMsg.edit('❌ Google Gemini 圖片生成失敗：內容可能不符合安全政策，請嘗試其他指令。');
          } else {
            await thinkingMsg.edit('❌ Google Gemini 圖片生成失敗，請稍後再試。');
          }
          return;
        }

      } else if (modelToUse === 'openai') {
        // 使用 OpenAI 生成圖片
        generatorName = config.openai.imageModel;
        imageSize = detectImageSize(rawPrompt);
        imageQuality = config.openai.imageQuality || 'auto';

        const imageOptions = {
          model: generatorName,
          prompt,
          n: 1,
          size: imageSize,
        };

        if (imageQuality && imageQuality !== 'auto') {
          imageOptions.quality = imageQuality;
        }

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

      if (modelToUse === 'gemini' && geminiResponseText) {
        embed.addFields({ name: '模型回覆', value: geminiResponseText.substring(0, 1024) });
      }

      if (modelToUse === 'openai') {
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
      console.error('❌ 生成圖片錯誤:', err);
      await thinkingMsg.edit(`❌ 圖片生成失敗，請稍後再試。錯誤資訊: ${err.message || '未知錯誤'}`);
    }
  });
}

module.exports = {
  generateAndSendImage,
};