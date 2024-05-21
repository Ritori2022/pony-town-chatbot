//共用函数
const puppeteer = require('puppeteer');

async function clickButton(page) {
    await page.click('button.px-3');
  }

  async function getWSEndpoint(port) {
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        const data = await res.json();
        const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
        return browserWSEndpoint;
      } catch (error) {
        console.error(`获取 WebSocket 端点失败 (尝试 ${retries + 1}/${maxRetries}):`, error);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('获取 WebSocket 端点失败,已达到最大重试次数');
  }

  async function getChatLogs(page) {
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const chatLogs = await page.evaluate(() => {
          const chatLogElement = document.querySelector('.chat-log-scroll-inner');
          return chatLogElement.innerText;
        });
  
        const chatLines = chatLogs.split('\n').filter(line => line.trim() !== '');
        const parsedLogs = chatLines.map(line => {
          const match = line.match(/^(\d{2}:\d{2})\[(.+?)\]\s*(.*)$/);
          if (match) {
            const [_, timestamp, name, message] = match;
            return { timestamp, name, message };
          } else {
            console.warn(`跳过无效的聊天记录行: ${line}`);
            return null;
          }
        }).filter(log => log !== null);
  
        return parsedLogs;
      } catch (error) {
        console.error(`获取聊天记录失败 (尝试 ${retries + 1}/${maxRetries}):`, error);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('获取聊天记录失败,已达到最大重试次数');
  }

  async function sendMessage(page, message) {
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const isChatBoxOpen = await page.evaluate(() => {
          const chatBox = document.querySelector('chat-box .chat-box');
          return chatBox && chatBox.offsetParent !== null;
        });
  
        if (!isChatBoxOpen) {
          await page.click('chat-box .chat-open-button');
        }
  
        await page.type('chat-box .chat-box .chat-textarea', message);
  
        await page.evaluate(() => {
          const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
          sendButton.click();
        });
  
        return;
      } catch (error) {
        console.error(`发送消息失败 (尝试 ${retries + 1}/${maxRetries}):`, error);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('发送消息失败,已达到最大重试次数');
  }

  async function findAndClickSendButton(page) {
    const sendButtonSelector = 'button.mb-1.mr-1.flex.h-8.w-8.items-center.justify-center.rounded-full.bg-black.text-white.transition-colors.hover\\:opacity-70.focus-visible\\:outline-none.focus-visible\\:outline-black.disabled\\:bg-\\[\\\#D7D7D7\\].disabled\\:text-\\[\\\#f4f4f4\\].disabled\\:hover\\:opacity-100.dark\\:bg-white.dark\\:text-black.dark\\:focus-visible\\:outline-white.disabled\\:dark\\:bg-token-text-quaternary.dark\\:disabled\\:text-token-main-surface-secondary path[d="M15.192 8.906a1.143 1.143 0 0 1 1.616 0l5.143 5.143a1.143 1.143 0 0 1-1.616 1.616l-3.192-3.192v9.813a1.143 1.143 0 0 1-2.286 0v-9.813l-3.192 3.192a1.143 1.143 0 1 1-1.616-1.616z"]';
    
    await page.waitForSelector(sendButtonSelector, { timeout: 5000 });
    
    await page.click(sendButtonSelector);
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

  module.exports = {
    clickButton,
    getWSEndpoint,
    getChatLogs,
    sendMessage,
    findAndClickSendButton,
    sendMessageToChatGPT,
  };