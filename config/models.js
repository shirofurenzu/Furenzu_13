// models.js

/**
 * 定義可供使用者選擇的 AI 模型列表。
 * 每個模型物件包含：
 * - name: 顯示給使用者看的易讀名稱。
 * - value: 實際用於程式碼內部邏輯的內部值（格式為 'provider/model_name'）。
 *
 * 你可以在這裡輕鬆地添加、修改或刪除模型，而無需觸及主要邏輯檔案。
 */
const AVAILABLE_MODELS = [
    { name: 'OpenAI GPT-4o', value: 'openai/gpt-4o' },
    { name: 'OpenAI GPT-4o-mini', value: 'openai/gpt-4o-mini' },
    { name: 'OpenAI GPT-4.1', value: 'openai/gpt-4.1' },
    { name: 'OpenAI GPT-4.1-mini', value: 'openai/gpt-4.1-mini' },
    { name: 'OpenAI GPT-4.1-nano', value: 'openai/gpt-4.1-nano' },
    { name: 'Gemini 2.5 Flash', value: 'gemini/gemini-2.5-flash-preview-05-20' },
    { name: 'Gemini 2.0 Flash', value: 'gemini/gemini-2.0-flash' },
    //{ name: 'Gemini 2.0 Flash Image', value: 'gemini/gemini-2.0-flash-preview-image-generation' },
    // { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro-preview-05-06' },
    // 範例：可以添加更多模型
    // { name: 'OpenAI GPT-4', value: 'openai/gpt-4' },
    // { name: 'Gemini Pro (舊版)', value: 'gemini/gemini-pro' },
    //舊模型
    // { name: 'OpenAI GPT-4o', value: 'openai/gpt-4o' },
    // { name: 'OpenAI GPT-4o-mini', value: 'openai/gpt-4o-mini' },
    // { name: 'OpenAI GPT-4.1', value: 'openai/gpt-4.1' },
    // { name: 'OpenAI GPT-4.1-mini', value: 'openai/gpt-4.1-mini' },
    // { name: 'OpenAI GPT-4.1-nano', value: 'openai/gpt-4.1-nano' },
    // { name: 'Gemini 2.0 Flash', value: 'gemini/gemini-2.0-flash' },
    //{ name: 'OpenAI o3', value: 'openai/o3' },
    //{ name: 'OpenAI o4-mini', value: 'openai/o4-mini' },
];

module.exports = {
    AVAILABLE_MODELS
};