const { EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai'); // 引入 Modality
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 初始化 OpenAI 客戶端
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

// 初始化 Google Gemini 客戶端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_Paid);
const geminiImageModel = genAI.getGenerativeModel({ model: process.env.GOOGLE_GEMINI_IMAGE_MODEL });

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
  if (prompt.includes('直圖')) return process.env.VERTICAL_IMAGE_SIZE;
  if (prompt.includes('橫圖')) return process.env.HORIZONTAL_IMAGE_SIZE;
  return process.env.DEFAULT_IMAGE_SIZE;
}

/**
 * 生成並發送圖片到 Discord 頻道。
 * 根據頻道 ID 預設使用 OpenAI DALL-E 3 或 Google Gemini 圖片生成。
 * @param {Client} client Discord 客戶端實例。
 */
async function generateAndSendImage(client) {
  if (!client.isReady()) {
    await new Promise(resolve => client.once(Events.ClientReady, resolve));
  }
  // 設定機器人監聽的頻道 ID 及其對應的預設模型
  const channelModelMap = {
    [process.env.DISCORD_CHANNEL_ID3]: 'openai',
    [process.env.DISCORD_CHANNEL_ID5]: 'gemini',
  };

  client.on('messageCreate', async (message) => {
    // 檢查訊息是否來自配置的頻道
    const modelToUse = channelModelMap[message.channel.id];
    if (!modelToUse) return; // 如果不是配置的頻道，則不處理

    if (message.author.bot) return;

    const rawPrompt = message.content.trim();
    if (!rawPrompt) return;

    const thinkingMsg = await message.reply('🖌️ 生成圖片中，請稍後...');
    const prompt = cleanPrompt(rawPrompt); // DALL-E 3 使用清理後的 prompt
    let imageUrl = '';
    let generatorName = '';
    let fileName = '';
    let attachment = null;
    let imageSize = ''; // DALL-E 3 專用尺寸，Gemini 圖片生成不直接支援此參數
    let geminiResponseText = ''; // 用來儲存 Gemini 回傳的文本部分

    try {
      if (modelToUse === 'gemini') {
        // 使用 Google Gemini 生成圖片
        generatorName = process.env.GOOGLE_GEMINI_IMAGE_MODEL; // 動態讀取模型名稱
        try {
          // Gemini 圖片生成不直接支援尺寸參數，將尺寸關鍵字視為描述的一部分
          const geminiPrompt = rawPrompt; // 使用原始 prompt，因為 cleanPrompt 可能會移除尺寸關鍵字

          const result = await geminiImageModel.generateContent({
            contents: [{ role: "user", parts: [{ text: geminiPrompt }] }], // 傳入 prompt
            // 關鍵修改：明確指定回應模態為文本和圖片
            generationConfig: {
             
              responseModalities: ["TEXT", "IMAGE"], // 必須指定 TEXT 和 IMAGE
            },
            safetySettings: [ // 可選：加入安全性設定
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
          });

          const response = await result.response;
          let imageFound = false;

          // 遍歷所有回傳的部分，查找圖片和文本
          for (const part of response.candidates[0].content.parts) {
            if (part.text) {
              geminiResponseText = part.text; // 儲存文本部分
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
          // 檢查錯誤訊息是否包含內容被阻擋
          if (geminiError.message && geminiError.message.includes('safety')) {
            await thinkingMsg.edit('❌ Google Gemini 圖片生成失敗：內容可能不符合安全政策，請嘗試其他指令。');
          } else {
            await thinkingMsg.edit('❌ Google Gemini 圖片生成失敗，請稍後再試。');
          }
          return;
        }

      } else if (modelToUse === 'openai') {
        // 使用 OpenAI DALL-E 3 生成圖片
        generatorName = process.env.OPEN_AI_IMAGE_MODEL; // 動態讀取模型名稱
        imageSize = detectImageSize(rawPrompt); // DALL-E 3 專用尺寸
        const response = await openai.images.generate({
          model: process.env.OPEN_AI_IMAGE_MODEL,
          prompt, // 使用清理後的 prompt
          n: 1,
          size: imageSize,
          response_format: 'url',
        });
        imageUrl = response.data[0].url;

        // 下載圖片
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imageResponse.data, 'binary');
        fileName = `openai_image_${Date.now()}.png`;
        attachment = new AttachmentBuilder(buffer, { name: fileName });
      } else {
        // 理論上不會發生，但以防萬一
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

      // 如果 Gemini 回傳了文本，也加到 Embed 中
      if (modelToUse === 'gemini' && geminiResponseText) {
        embed.addFields({ name: '模型回覆', value: geminiResponseText.substring(0, 1024) }); // 限制長度以防過長
      }

      // 只有當模型是 OpenAI 且尺寸資訊有意義時才顯示圖片尺寸
      if (modelToUse === 'openai' && imageSize && imageSize !== 'undefined') {
        embed.addFields({ name: '圖片尺寸', value: imageSize });
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