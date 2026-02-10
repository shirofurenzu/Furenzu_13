require('dotenv').config();

const { env } = process;

module.exports = {
  PORT: env.PORT || '3000',

  // Discord 基礎設定
  DISCORD_MODE: env.DISCORD_MODE || 'channel',
  DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
  CLIENT_ID: env.CLIENT_ID,
  
  // 頻道設定
  DISCORD_CHANNEL_ID: env.DISCORD_CHANNEL_ID,
  DISCORD_CHANNEL_MAX_MESSAGE: Number(env.DISCORD_CHANNEL_MAX_MESSAGE) || 5,
  DISCORD_FORUM_ID: env.DISCORD_FORUM_ID,
  
  // === 功能開關 (Feature Flags) ===
  // 如果 .env 沒寫，預設為 true (開啟)
  // 字串轉布林值的技巧: env.XXX === 'false' ? false : true
  ENABLE_DAILY_REMIND: env.ENABLE_DAILY_REMIND === 'false' ? false : true,
  ENABLE_DAILY_WEATHER: env.ENABLE_DAILY_WEATHER === 'false' ? false : true,
  ENABLE_AI_CHAT: env.ENABLE_AI_CHAT === 'false' ? false : true, // 預留給 AI 的開關

  // 每日提醒
  DAILY_REMIND_CHANNEL_ID: env.DAILY_REMIND_CHANNEL_ID,
  DAILY_REMIND_USER_ID: env.DAILY_REMIND_USER_ID,

  // 每日天氣
  DAILY_WEATHER_CHANNEL_ID: env.DAILY_WEATHER_CHANNEL_ID,
};