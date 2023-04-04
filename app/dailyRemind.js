const channelId = '1088826285482070207'; // 設置提醒的頻道ID
const userId = '337612075285086209'; // 設置要標記的角色ID
const message = `早安 <@${userId}>!`;// 設置提醒內容
const targetTime = [07, 00, 00];// 設定目標時間
// const message2 = `午安 <@${userId}>!`;// 設置提醒內容
// const targetTime2 = [10, 10, 30];// 設定目標時間

function dailyRemind(client){
    client.on("ready", () => {
      // 計算現在時間與下一個目標時間的時間差
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(),...targetTime); // 設定目標時間
      const diff = target.getTime() - now.getTime();
      const delay = diff > 0 ? diff : 86400000 + diff; // 如果現在時間已經超過了目標時間，則需要加上一個 24 小時的時間差
     // 等待時間差到達後執行提醒程式碼
     setTimeout(() => {
      // 獲取指定的頻道
      const channel = client.channels.cache.get(channelId);
      // 發送提醒內容
      channel.send(message);
      // 設定每 24 小時執行一次提醒程式碼
      setInterval(() => {
        channel.send(message);
      }, 24 * 60 * 60 * 1000);
    }, delay);
    console.log(`dailyRemind 執行中！`);
    });
    };

    // function dailyRemind2(client){
    //     client.on("ready", () => {
    //       // 計算現在時間與下一個目標時間的時間差
    //       const now = new Date();
    //       const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(),...targetTime2); // 設定目標時間
    //       const diff = target.getTime() - now.getTime();
    //       const delay = diff > 0 ? diff : 86400000 + diff; // 如果現在時間已經超過了目標時間，則需要加上一個 24 小時的時間差
    //      // 等待時間差到達後執行提醒程式碼
    //      setTimeout(() => {
    //       // 獲取指定的頻道
    //       const channel = client.channels.cache.get(channelId);
    //       // 發送提醒內容
    //       channel.send(message2);
    //       // 設定每 24 小時執行一次提醒程式碼
    //       setInterval(() => {
    //         channel.send(message2);
    //       }, 24 * 60 * 60 * 1000);
    //     }, delay);
    //     console.log(`dailyRemind2 已上線！`);
    //     });
    //     };

    module.exports = {
        dailyRemind,
       // dailyRemind2,
    };
