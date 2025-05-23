const channelId = '1088826285482070207'; 
const userId = '337612075285086209'; 
const targetReminders = [
    {
        time: [08, 30, 00], // 第一個提醒時間
        message: `早安 <@${userId}>!` // 第一個提醒消息
    },
    {
        time: [23, 30, 00], // 第二個提醒時間
        message: `晚安 <@${userId}>!` // 第二個提醒消息
    }
    // 可添加更多提醒
];

function dailyRemind(client) {
    client.on("ready", () => {
        targetReminders.forEach((reminder) => {
            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...reminder.time); 
            let diff = target.getTime() - now.getTime();
            let delay = diff > 0 ? diff : 86400000 + diff;

            setTimeout(() => {
                const channel = client.channels.cache.get(channelId);
                channel.send(reminder.message); // 發送對應的消息內容
                setInterval(() => {
                    channel.send(reminder.message); // 每24小時發送對應的消息內容
                }, 24 * 60 * 60 * 1000); // 重新設定24小時循環
            }, delay);
        });
        console.log(`dailyRemind 執行中！`);
    });
}

module.exports = {
    dailyRemind,
};