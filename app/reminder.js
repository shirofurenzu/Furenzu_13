function reminder(client) {
  client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // 避免機器人自我觸發
  if (!message.content.startsWith('rm ')) return; // 判斷是否為指令

  const args = message.content.trim().split(/ +/g); // 分割指令
  const command = args.shift().toLowerCase(); // 取得指令名稱

  if (command === 'rm') { // 如果是提醒指令
    const [month, date, hours, minutes, ...reminder] = args; // 取得時間和提醒事項
    const reminderText = reminder.join(' ');

    if (!month || !date || !hours || !minutes || !reminderText) { // 如果有任何一個參數為空
      return message.channel.send('請輸入正確的指令格式：rm <月> <日> <時> <分> <提醒事項>'); // 回應錯誤訊息
    }

    const remindTime = new Date(); // 建立時間物件

    remindTime.setMonth(parseInt(month, 10) - 1); // 設定月份（輸入的是1-12，需要轉成0-11）
    remindTime.setDate(parseInt(date, 10)); // 設定日期
    remindTime.setHours(parseInt(hours, 10)); // 設定小時
    remindTime.setMinutes(parseInt(minutes, 10)); // 設定分鐘
    remindTime.setUTCHours(remindTime.getUTCHours()); // 設定時區（UTC+8）

    const now = new Date(); // 取得目前時間

    if (remindTime <= now) { // 如果提醒時間早於目前時間
      return message.channel.send('請輸入未來的時間'); // 回應錯誤訊息
    }

    const timeDiff = remindTime.getTime() - now.getTime(); // 計算時間差

    setTimeout(() => { // 設定提醒時間
      message.reply(`時間到了，提醒您：${reminderText}`); // 回覆提醒訊息
    }, timeDiff);

    message.channel.send(`提醒設置完成\n將於${month}月${date}日${hours}點${minutes}分\n提醒您 ${reminderText}`); // 回應設置完成訊息
   }
  });
};

function reminderToday(client) {
  client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // 避免機器人自我觸發
  if (!message.content.startsWith('rmt ')) return; // 判斷是否為指令

  const args = message.content.trim().split(/ +/g); // 分割指令
  const command = args.shift().toLowerCase(); // 取得指令名稱

  if (command === 'rmt') { // 如果是提醒指令
    const [hours, minutes, ...reminder] = args; // 取得時間和提醒事項
    const reminderText = reminder.join(' ');

    if (!hours || !minutes || !reminderText) { // 如果有任何一個參數為空
      return message.channel.send('請輸入正確的指令格式：rm <月> <日> <時> <分> <提醒事項>'); // 回應錯誤訊息
    }

    const remindTime = new Date(); // 建立時間物件

    remindTime.setHours(parseInt(hours, 10)); // 設定小時
    remindTime.setMinutes(parseInt(minutes, 10)); // 設定分鐘
    remindTime.setUTCHours(remindTime.getUTCHours()); // 設定時區（UTC+8）

    const now = new Date(); // 取得目前時間

    if (remindTime <= now) { // 如果提醒時間早於目前時間
      return message.channel.send('請輸入未來的時間'); // 回應錯誤訊息
    }

    const timeDiff = remindTime.getTime() - now.getTime(); // 計算時間差

    setTimeout(() => { // 設定提醒時間
      message.reply(`時間到了，提醒您：${reminderText}`); // 回覆提醒訊息
    }, timeDiff);

    message.channel.send(`提醒設置完成\n將於${hours}點${minutes}分\n提醒您 ${reminderText}`); // 回應設置完成訊息
   }
  });
};

module.exports = {
  reminder,
  reminderToday,
};