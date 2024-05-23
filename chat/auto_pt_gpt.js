//使用chatgpt网页版来驱动聊天机器人的脚本
const { clickButton, getWSEndpoint, getChatLogs, sendMessage, findAndClickSendButton} = require('../common.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function loadPrompt() {
  try {
    const promptFile = 'chat/prompt.txt';
    const prompt = await fs.promises.readFile(promptFile, 'utf-8');
    return prompt.trim();
  } catch (error) {
    console.error('读取提示词文件时发生错误:', error);
    return '';
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
      await new Promise(resolve => setTimeout(resolve, 10000));
            
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

async function processMessages(page) {
  try {
    const chatLogs = await getChatLogs(page);
    const lastLog = chatLogs[chatLogs.length - 1];

    if (lastLog.name !== '流霜黯淡(npc)(任意聊天激活)') {
      await page.keyboard.press('9');
      await page.keyboard.press('8');
      await page.keyboard.press('7');
      console.log('Pressed key 9');
      const lastTenLogs = chatLogs.slice(-1);
      const message = lastTenLogs.map(log => `[${log.name}]: ${log.message}`).join('\n');

      // 从文件中加载提示词
      const prompt = await loadPrompt();

      // 添加提示词
      const promptedMessage = prompt + '\n' + message;

      console.log('发送到ChatGPT的消息内容:');
      console.log(promptedMessage);

      await sendMessageToChatGPT(page, promptedMessage);
    }
  } catch (error) {
    console.error('发生错误:', error);
  }

  setTimeout(() => processMessages(page), 1000);
}

(async () => {
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

    await processMessages(page);
  } catch (error) {
    console.error('发生错误:', error);
  }
})();