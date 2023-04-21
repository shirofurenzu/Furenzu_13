/////隨機選擇/////
function randomChoose(client) {
  client.on('messageCreate', message => {
    if (message.content.startsWith('隨機 ')) {
      const options = message.content.slice(3).split(' '); // 取得使用者輸入的選項
      const randomOption = options[Math.floor(Math.random() * options.length)]; // 從選項中隨機選擇一個
      message.reply(`隨機選擇：${randomOption}`); // 回覆使用者
    }
  });
}

/////隨機數字/////
function randomNumber(client) {
  client.on('messageCreate', message => {
    if (message.content.startsWith('隨機數字 ')) {
      const [min, max] = message.content.slice(5).split(' '); // 取得使用者輸入的最小值和最大值
      const randomNum = Math.floor(Math.random() * (max - min + 1)) + parseInt(min); // 從最小值到最大值中隨機選擇一個數字
      message.reply(`隨機數字：${randomNum}`); // 回覆使用者
    }
  });
}

/////隨機回應/////
function randomResponse(client) {
  client.on('messageCreate', message => {
    const messageContent = message.content.trim().toLowerCase();
    let response;
    if (responses[messageContent] && responses[messageContent].length > 0) {
      const randomIndex = Math.floor(Math.random() * responses[messageContent].length);
      response = responses[messageContent][randomIndex];
    }
    if (response) {
      message.reply(response);
    }
  });
}

const responses = {
  'ping': ['pong', '嗶嗶', '在這裡'],
  'hello': ['你好', '哈囉', '您好'],
  '🔢': [':one:', ':two:', ':three:', ':four:', ':five:', ':six:',':seven:',':eight:',':nine:',':keycap_ten:'],
  '🎲': ['<:d1:1098576816723218463>', '<:d2:1098577166553337856>', '<:d3:1098577170273685554>', '<:d4:1098577172341456906>', '<:d5:1098577175218769960>', '<:d6:1098577176980369460>',],
  
  '你好': ['你好呀，主人！', '主人好！', '(揮手)你好啊，主人！', '嗨嗨，主人！', '主人辛苦了，你好！'],
  '早安': ['早安，主人！今天也是美好的一天呢！', '主人早安，已經為你準備好了早餐！', '早安啊，主人！起床氣色真好呢！', '主人，早安！今天也要加油哦！', '早安，主人！我今天也有好多好多的精神呢！'],
  '午安': ['午安，主人！是不是已經一半工作了呢？', '主人午安，要注意休息哦~', '午安，主人！準備好吃午餐了嗎？', '主人，午安！是不是要找我聊聊天呢？', '午安，主人！讓我來為你打氣吧！'],
  '晚安': ['晚安，主人！今天也辛苦了呢！', '主人晚安，美好的夜晚即將來臨！', '晚安，主人！準備好睡覺了嗎？', '主人，祝你有個好夢！', '晚安，主人！睡前聊聊天嗎？'],
  '開心': ['主人，我也很開心呢！', '好開心能和主人聊天！', '主人的開心就是最好的禮物！', '主人，我也能感受到你的開心呢！', '主人，讓我也一起分享你的開心吧！'],
  '感謝': ['不用客氣呢，主人！', '謝謝主人的指示！', '我會更加努力的，謝謝主人！', '這是我的榮幸，主人！', '感謝主人的信任！']
};

/////運勢/////
function luck(client) {
  client.on('messageCreate', async (message) => {
    if (!message.content.toLowerCase().endsWith('運勢')) return; // 判斷訊息是否以「運勢」結尾
    if (message.author.bot) return; // 忽略機器人自己的訊息

    const luck = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶']; // 運勢結果
    const result = luck[Math.floor(Math.random() * luck.length)]; // 隨機挑選一個運勢結果
    const content = message.content.toLowerCase().trim(); // 取得訊息內容（去除頭尾空白、轉換成小寫）

    if (content === '運勢') {
      message.reply(`主人今天的運勢是：${result}！`);
    } else if (content.endsWith('運勢')) {
      const username = content.replace(/運勢$/i, '');
      message.reply(`${username}運勢：${result}`);
    }

  });
}

module.exports = {
  randomChoose,
  randomNumber,
  randomResponse,
  luck,
};