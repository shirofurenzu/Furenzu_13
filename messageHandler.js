function getRandomResponse(responses) {
    if (!responses || responses.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }
  function handleMessage(message) {
    const messageContent = message.content.toLowerCase();
    let response;
    if (messageContent === '運勢') {
      const luck = ["大吉", "中吉", "小吉", "吉", "末吉", "凶", "大凶"];
      const randomIndex = Math.floor(Math.random() * luck.length);
      response = `主人今天的運勢是：${luck[randomIndex]}！`;
    } else {
      response = getRandomResponse(responses[messageContent]);
    }
    if (response) {
      message.reply(response);
    }
  }
  
  const responses = {
    'ping': ['pong', '嗶嗶', '在這裡'],
    'hello': ['你好', '哈囉', '您好'],

    '你好': ['你好呀，主人！', '主人好！', '(揮手)你好啊，主人！', '嗨嗨，主人！', '主人辛苦了，你好！'],
    '早安': ['早安，主人！今天也是美好的一天呢！', '主人早安，已經為你準備好了早餐！', '早安啊，主人！起床氣色真好呢！', '主人，早安！今天也要加油哦！', '早安，主人！我今天也有好多好多的精神呢！'],
    '午安': ['午安，主人！是不是已經一半工作了呢？', '主人午安，要注意休息哦~', '午安，主人！準備好午餐了嗎？', '主人，午安！是不是要找我聊聊天呢？', '午安，主人！讓我來為你打氣吧！'],
    '晚安': ['晚安，主人！今天也辛苦了呢！', '主人晚安，美好的夜晚即將來臨！', '晚安，主人！準備好睡覺了嗎？', '主人，祝你有個好夢！', '晚安，主人！睡前聊聊天嗎？'],
    '開心': ['主人，我也很開心呢！', '好開心能和主人聊天！', '主人的開心就是最好的禮物！', '主人，我也能感受到你的開心呢！', '主人，讓我也一起分享你的開心吧！'],
    '感謝': ['不用客氣呢，主人！', '謝謝主人的指示！', '我會更加努力的，謝謝主人！', '這是我的榮幸，主人！', '感謝主人的信任！']
  };
  

  module.exports = { getRandomResponse,  handleMessage,responses };