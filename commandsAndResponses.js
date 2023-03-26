const commandsAndResponses = {
  hi: {
    name: "hi",
    description: "response.",
    getRandomResponse: function() {
      const responses = ["Hi!", "Hello!", "你好!"];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  },
  ping: {
    name: "ping",
    description: "Ping Pong!",
    getRandomResponse: function() {
      const responses = ["Pong!", "Bong!", "Dong!"];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  },
  早安: {
    name: "早安",
    description: "response.",
    getRandomResponse: function() {
      const responses = ["早安你好!","早安!主人:heart:~"];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  },
  晚安: {
    name: "晚安",
    description: "response.",
    getRandomResponse: function() {
      const responses = ["祝您有個好夢!主人:heart:~"];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  },
  luck: {
    name: "luck",
    description: "本日運勢",
    getRandomResponse: function() {
      const responses = ["大吉", "中吉", "小吉", "吉", "末吉", "凶", "大凶"];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  },





    
  }

module.exports = {
  commandsAndResponses
};
