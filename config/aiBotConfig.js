require('dotenv').config();

const config = {
  // Discord 相關設定
  discord: {
    // 頻道 ID 列表 (似乎用不到)
    //channels: {
    //  CHAT: process.env.DISCORD_CHANNEL_CHAT,
    //  GPT_CHAT: process.env.DISCORD_CHANNEL_GPT_CHAT,
    //  GPT_IMAGE: process.env.DISCORD_CHANNEL_GPT_IMAGE,
    //  GEMINI_CHAT: process.env.DISCORD_CHANNEL_GEMINI_CHAT,
    //  GEMINI_IMAGE: process.env.DISCORD_CHANNEL_GEMINI_IMAGE,
    // },
    
    // 對話歷史輪數；一輪包含使用者訊息與 AI 回覆。5 輪等於最多 10 則訊息。
    maxHistory: 5,

    // 單則訊息及對話歷史可保留的圖片總大小上限（MB；預設維持原本 20 MiB）。
    maxImageContextMB: 20,

    // [聊天頻道] 的模型配置
    chatChannelConfig: [
      { 
        id: process.env.DISCORD_CHANNEL_CHAT, 
        provider: 'openai', 
        name: 'gpt-6-luna' 
      },
      { 
        id: process.env.DISCORD_CHANNEL_GPT_CHAT, 
        provider: 'openai', 
        name: 'gpt-6.1-sol' 
      },
      { 
        id: process.env.DISCORD_CHANNEL_GEMINI_CHAT, 
        provider: 'gemini', 
        name: 'gemini-3.5-flash-lite' 
      }
    ],

    // [圖片頻道] 的預設模型配置 (Fallback)
    imageChannelMap: {
      [process.env.DISCORD_CHANNEL_GPT_IMAGE]: 'openai',
      [process.env.DISCORD_CHANNEL_GEMINI_IMAGE]: 'gemini',
    }
  },

  // [OpenAI 相關設定]
  openai: {
    apiKey: process.env.OPEN_AI_API_KEY, 
    // Persona 設定
    persona: '你是一個樂於助人的助手，會以繁體中文回答使用者的問題。',
    
    // 預設圖片生成設定
    imageModel: 'gpt-image-2.5-sunburst',
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
    
    // 預設圖片生成設定
    imageModel: 'gemini-nano-banana-2.1',
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
    { name: 'Gemini 3.1 Flash Image', value: 'gemini/gemini-3.1-flash-image' },//3
    { name: 'Gemini 3 Pro Image', value: 'gemini/gemini-3-pro-image:default' }//1
  ]
};

module.exports = config;
