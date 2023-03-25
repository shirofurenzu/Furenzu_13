require('dotenv').config();

const { env } = process;

module.exports = {
  PORT: env.PORT || '3000',

  // Discord
  DISCORD_MODE: env.DISCORD_MODE || 'channel',
  DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID: env.DISCORD_CHANNEL_ID,
  DISCORD_CHANNEL_MAX_MESSAGE: Number(env.DISCORD_CHANNEL_MAX_MESSAGE) || 5,
  DISCORD_FORUM_ID: env.DISCORD_FORUM_ID,
  CLIENT_ID:env.CLIENT_ID,

};
