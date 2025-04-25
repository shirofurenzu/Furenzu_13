const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

function cleanPrompt(rawPrompt) {
  return rawPrompt.replace(/直圖|橫圖/g, '').trim();
}

function detectImageSize(prompt) {
  if (prompt.includes('直圖')) return process.env.VERTICAL_IMAGE_SIZE;
  if (prompt.includes('橫圖')) return process.env.HORIZONTAL_IMAGE_SIZE;
  return process.env.DEFAULT_IMAGE_SIZE;
}

async function generateAndSendImage(client) {
  if (!client.isReady()) {
    await new Promise(resolve => client.once('ready', resolve));
  }

  const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID3);
  if (!channel) {
    console.error('❌ 找不到指定頻道');
    return;
  }

  client.on('messageCreate', async (message) => {
    if (message.channel.id !== process.env.DISCORD_CHANNEL_ID3) return;
    if (message.author.bot) return;

    const rawPrompt = message.content.trim();
    if (!rawPrompt) return;

    const thinkingMsg = await message.reply('🖌️ 生成圖片中，請稍後...');
    const imageSize = detectImageSize(rawPrompt);
    const prompt = cleanPrompt(rawPrompt);

    try {
      const response = await openai.images.generate({
        model: process.env.OPEN_AI_IMAGE_MODEL,
        prompt,
        n: 1,
        size: imageSize,
        response_format: 'url',
      });

      const imageUrl = response.data[0].url;

      // 下載圖片
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imageResponse.data, 'binary');

      const fileName = `image_${Date.now()}.png`;
      const attachment = new AttachmentBuilder(buffer, { name: fileName });

      const now = new Date();
      const timestamp = now.toLocaleString('zh-TW', { hour12: false });

      const embed = new EmbedBuilder()
        .setTitle('🎨 生成圖片結果')
        .setColor('#00bcd4')
        .addFields(
          { name: '原始 Prompt', value: rawPrompt },
          { name: '圖片尺寸', value: imageSize },
          { name: '生成時間', value: timestamp }
        )
        .setFooter({ text: '由 DALL·E 3 自動生成' });

      await message.reply({ embeds: [embed], files: [attachment] });
      await thinkingMsg.delete();

    } catch (err) {
      console.error('❌ 生成圖片錯誤:', err);
      await thinkingMsg.edit('❌ 圖片生成失敗，請稍後再試。');
    }
  });
}

module.exports = {
  generateAndSendImage,
};
