//用于单人桌面角色扮演的脚本，接受玩家聊天输入，数字选择主题，字母选择选项
const { clickButton, getWSEndpoint, getChatLogs, sendMessage, findAndClickSendButton } = require('../common.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function sendInitialMessage(page) {
  try {
    await sendMessage(page, '守秘人模块已重置');
  } catch (error) {
    console.error('发送初始消息失败:', error);
  }
}

async function sendMessageToChatGPT(page, messageToSend) {
  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      // 连接到 ChatGPT 页面
      const chatgptBrowserWSEndpoint = await getWSEndpoint(9223); // 替换为 ChatGPT 的端口号
      const chatgptBrowser = await puppeteer.connect({
        browserWSEndpoint: chatgptBrowserWSEndpoint.replace('http://', 'ws://'),
        defaultViewport: null,
      });
      const chatgptPages = await chatgptBrowser.pages();
      const chatgptPage = chatgptPages[0];
            
      async function findAndClickSendButton(page) {
        const sendButtonSelector = 'button.mb-1.mr-1.flex.h-8.w-8.items-center.justify-center.rounded-full.bg-black.text-white.transition-colors.hover\\:opacity-70.focus-visible\\:outline-none.focus-visible\\:outline-black.disabled\\:bg-\\[\\\#D7D7D7\\].disabled\\:text-\\[\\\#f4f4f4\\].disabled\\:hover\\:opacity-100.dark\\:bg-white.dark\\:text-black.dark\\:focus-visible\\:outline-white.disabled\\:dark\\:bg-token-text-quaternary.dark\\:disabled\\:text-token-main-surface-secondary path[d="M15.192 8.906a1.143 1.143 0 0 1 1.616 0l5.143 5.143a1.143 1.143 0 0 1-1.616 1.616l-3.192-3.192v9.813a1.143 1.143 0 0 1-2.286 0v-9.813l-3.192 3.192a1.143 1.143 0 1 1-1.616-1.616z"]';
            
        await page.waitForSelector(sendButtonSelector, { timeout: 5000 });
            
        await page.click(sendButtonSelector);
      }
            
      // 在 ChatGPT 页面中输入消息并获取回复
      await chatgptPage.type('#prompt-textarea', messageToSend);
            
      // 等待1秒钟,让页面有时间更新
      await new Promise(resolve => setTimeout(resolve, 1000));
            
      const sendButtonSelector1 = 'button.flex.items-center.justify-center.rounded-full';
      const sendButtonSelector2 = 'button.mb-1.mr-1.flex.h-8.w-8.items-center.justify-center.rounded-full';
            
      await chatgptPage.waitForFunction((selector1, selector2) => {
        const button1 = document.querySelector(selector1);
        const button2 = document.querySelector(selector2);
        return (button1 && !button1.disabled) || (button2 && !button2.disabled);
      }, { timeout: 5000 }, sendButtonSelector1, sendButtonSelector2);
            
      await findAndClickSendButton(chatgptPage, sendButtonSelector1, sendButtonSelector2);
            
      await chatgptPage.waitForSelector('[data-testid^="conversation-turn-"]:last-of-type .markdown');
      await new Promise(resolve => setTimeout(resolve, 18000));
            
      const reply = await chatgptPage.evaluate(() => {
        return document.querySelector('[data-testid^="conversation-turn-"]:last-of-type .markdown').innerText;
      });
            
      console.log('ChatGPT的响应内容:');
      console.log(reply);
            
      // 将内容按照中文句号分段
      const segments = reply.split(/[。！？]/);
            
      // 逐段发送消息
      await page.keyboard.press('7');
      await page.keyboard.press('9');
      for (const segment of segments) {
        if (segment.trim() !== '') {
          await sendMessage(page, segment.trim() + '。');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      await page.keyboard.press('8');
      await page.keyboard.press('9');
            
      await chatgptBrowser.disconnect();
            
      break; // 成功获取回复,跳出重试循环
    } catch (error) {
      console.error(`获取 ChatGPT 回复失败 (尝试 ${retries + 1}/${maxRetries}):`, error);
      retries++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

const gameMapping = {
  '1': '奇幻',
  '2': '科幻',
  '3': '恐怖',
  '4': '盗梦空间',
  '5': '007',
  '6': '生化危机',
  '7': '朋克',
  '8': '后启示录',
  '9': '侏罗纪公园',
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