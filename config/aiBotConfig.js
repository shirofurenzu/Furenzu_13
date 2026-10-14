require('dotenv').config();

// 頻道 ID 設定可填一個 ID，或以逗號分隔的多個 ID。
function parseChannelIds(value) {
  return (value || '')
    .split(',')
    .map(channelId => channelId.trim())
    .filter(Boolean);
}

function chatChannels(envName, provider, name) {
  return parseChannelIds(process.env[envName]).map(id => ({ id, provider, name }));
}

function imageChannels(envName, provider, name) {
  return parseChannelIds(process.env[envName]).map(id => [id, { provider, name }]);
}

const memoryChannelIds = parseChannelIds(process.env.DISCORD_MEMORY_CHANNELS);

const config = {
  // Discord 相關設定
  discord: {
    // 對話歷史輪數；一輪包含使用者訊息與 AI 回覆。5 輪等於最多 10 則訊息。
    maxHistory: 5,

    // 單則訊息及對話歷史可保留的圖片總大小上限（MB；預設維持原本 20 MiB）。
    maxImageContextMB: 20,

    // 只在這些頻道啟用長期記憶。
    memoryChannelIds,
    // 每位使用者累積幾輪對話（使用者訊息＋bot 回覆）後整理一次長期記憶。
    // null 表示跟 maxHistory 相同；也可填數字自訂（大於 maxHistory 時，超出短期記憶的對話要等整理後才會記得）。
    memoryReviewMessageInterval: null,
    // 整理長期記憶用的模型；若該供應商未設定 API Key，改用使用者目前的聊天模型。
    memoryModel: { provider: 'gemini', name: 'gemini-3.5-flash-lite' },

    // [聊天頻道] 的模型配置
    chatChannelConfig: [
      ...chatChannels('DISCORD_CHANNEL_CHAT', 'openai', 'gpt-6-luna'),
      ...chatChannels('DISCORD_CHANNEL_GPT_CHAT', 'openai', 'gpt-6.1-sol'),
      ...chatChannels('DISCORD_CHANNEL_GEMINI_CHAT', 'gemini', 'gemini-3.5-flash-lite'),
    ],

    // [圖片頻道] 的預設供應商與模型配置
    imageChannelMap: Object.fromEntries([
      ...imageChannels('DISCORD_CHANNEL_GPT_IMAGE', 'openai', 'gpt-image-2.5-sunburst'),
      ...imageChannels('DISCORD_CHANNEL_GEMINI_IMAGE', 'gemini', 'gemini-nano-banana-2.1'),
    ])
  },

  // [OpenAI 相關設定]
  openai: {
    apiKey: process.env.OPEN_AI_API_KEY, 
    // Persona 設定
    persona: '你是一個樂於助人的助手，會以繁體中文回答使用者的問題。',
    
    // 預設圖片品質
    imageQuality: 'medium', 
    
    imageSize: {
      default: '1024x1024',
      vertical: '1024x1536',
      horizontal: '1536x1024',
    }
  },

  // [Gemini 相關設定]
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,      // 免費版 Key (Chat)
    apiKeyPaid: process.env.GEMINI_API_KEY_Paid, // 付費版 Key (Image)
  },

// 可供使用者選擇的「聊天」模型列表
  chatModels: [
    { name: 'OpenAI GPT-6.1-sol', value: 'openai/gpt-6.1-sol' },
    { name: 'OpenAI GPT-6-luna', value: 'openai/gpt-6-luna' },
    { name: 'OpenAI GPT-5-nano', value: 'openai/gpt-5-nano' },
    { name: 'Gemini 3.8 Flash', value: 'gemini/gemini-3.8-flash' },
    { name: 'Gemini 3.5 Flash Lite', value: 'gemini/gemini-3.5-flash-lite' },
    { name: 'Gemini 3.1 Flash Lite', value: 'gemini/gemini-3.1-flash-lite' }
  ],
    
  // 可供使用者選擇的「繪圖」模型列表 (格式: provider/model:quality)
  imageModels: [
    { name: 'GPT Image 2.5 sunburst (Low)', value: 'openai/gpt-image-2.5-sunburst:low' },
    { name: 'GPT Image 2.5 sunburst (Medium)', value: 'openai/gpt-image-2.5-sunburst:medium' },
    { name: 'GPT Image 2.5 sunburst (High)', value: 'openai/gpt-image-2.5-sunburst:high' },
        //gemini要設定api與服務/Request limit per model per minute for a project in the paid tier 1
    { name: 'Gemini 3.1 Flash Lite Image', value: 'gemini/gemini-3.1-flash-lite-image' },//3
    { name: 'Gemini Nano Banana 2.1🍌', value: 'gemini/gemini-nano-banana-2.1' },//3
    { name: 'Gemini 3 Pro Image', value: 'gemini/gemini-3-pro-image:default' }//1
  ]
};

module.exports = config;
