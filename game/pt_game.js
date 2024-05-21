//用于单人桌面角色扮演的脚本，接受玩家聊天输入，数字选择主题，字母选择选项
const { clickButton, getWSEndpoint, getChatLogs, sendMessage, findAndClickSendButton, sendMessageToChatGPT } = require('../common.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function sendInitialMessage(page) {
  try {
    await sendMessage(page, '守秘人模块已重置');
  } catch (error) {
    console.error('发送初始消息失败:', error);
  }
}

const gameMapping = {
  '1': '奇幻',
  '2': '科幻',
  '3': '恐怖',
  '4': '历史',
  '5': '007',
  '6': '摇滚乐队',
  '7': '朋克',
  '8': '后启示录',
  '9': '小马宝莉',
};

async function processMessages(page) {
  while (true) {
    try {
      const chatLogs = await getChatLogs(page);
      const lastLog = chatLogs[chatLogs.length - 1];

      if (lastLog.name !== '守密的莉莉娜(npc)(任意聊天激活)') {
        const lastMessage = lastLog.message.trim();
        let messageToSend = '';

        if (/^\d$/.test(lastMessage)) {
          const gameType = gameMapping[lastMessage];
          if (gameType) {
            messageToSend = `开始新${gameType}游戏。请耐心等候内容加载（大概20秒）`;
            await page.keyboard.press('7');
            await page.keyboard.press('9');
            await sendMessage(page, messageToSend);
            await page.keyboard.press('8');
            await page.keyboard.press('9');
          }
        } else if (/^[a-dA-D]$/.test(lastMessage)) {
          messageToSend = `我选择${lastMessage.toUpperCase()}。仅作为提醒：每轮游戏至少20回合。请总是给出选项。`;
          await page.keyboard.press('7');
          await page.keyboard.press('9');
          await sendMessage(page, `你选择了${lastMessage.toUpperCase()}。请耐心等候内容加载（大概20秒）`);
          await page.keyboard.press('8');
          await page.keyboard.press('9');
        } else if (lastMessage === '0') {
          messageToSend = '每轮游戏至少20回合,请继续游戏。';
          await sendMessage(page, messageToSend);
          // 将消息发送给 ChatGPT 并等待响应
          await sendMessageToChatGPT(page, messageToSend);
          continue; // 继续等待新的消息输入
        } else {
          // 忽略不是数字或字母 a、b、c、d 的消息
          continue; // 继续下一轮循环
        }

        await sendMessageToChatGPT(page, messageToSend);
      } else {
        // 如果最后一条消息是来自守密的莉莉娜(npc),说明当前没有新消息
        console.log('等待新消息...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒
        continue; // 继续下一轮循环
      }
    } catch (error) {
      console.error('处理消息时发生错误:', error);
      // 根据错误类型采取不同的处理方式,例如重试、延长超时时间、记录日志等
    }
  }
}

(async () => {
  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const browserWSEndpoint = await getWSEndpoint(9222);
      console.log('连接到浏览器:', browserWSEndpoint);

      const browser = await puppeteer.connect({
        browserWSEndpoint: browserWSEndpoint.replace('http://', 'ws://'),
        defaultViewport: null,
      });

      const pages = await browser.pages();
      const page = pages[0];
      console.log('已连接到页面:', page.url());

      // 发送初始消息
      await sendInitialMessage(page);

      await processMessages(page);
      break; // 成功连接,跳出重试循环
    } catch (error) {
      console.error(`连接到浏览器失败 (尝试 ${retries + 1}/${maxRetries}):`, error);
      retries++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (retries === maxRetries) {
    console.error('连接到浏览器失败,已达到最大重试次数');
  }
})();