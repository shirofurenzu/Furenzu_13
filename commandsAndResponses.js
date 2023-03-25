const responses = {
  luck: ["大吉", "中吉", "小吉", "吉", "末吉", "凶", "大凶"],
  ping: ["Pong!", "Bong!", "Dong!"]
};

module.exports = {
    ping: {
      description: "Ping Pong!",
      category: "General",
      response: getRandomResponse(responses.ping)
    },
    hi: {
      description: "Say Hello!",
      category: "General",
      response: "Hello!"
    },
    bye: {
        description: "Say bye!",
        category: "General",
        response: "Bye bye!"
      },
    早安: {
        description: "Speak",
        category: "General",
        response: "早安!主人:heart:~"
      },
    晚安: {
        description: "Speak",
        category: "General",
        response: "祝您有個好夢!主人:heart:~"
      },
    luck: {
        description: "本日運勢",
        category: "General",
        response: getRandomResponse(responses.luck)
      },




  };

  function getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
  }