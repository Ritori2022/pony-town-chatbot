//使用chatgpt网页驱动聊天脚本
const puppeteer = require('puppeteer');
const fs = require('fs');


async function clickButton(page) {
  await page.click('button.px-3');
}

async function getWSEndpoint(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`);
  const data = await res.json();
  const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
  return browserWSEndpoint;
}

async function getChatLogs(page) {
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
      console.warn(`Skipping invalid chat log line: ${line}`);
      return null;
    }
  }).filter(log => log !== null);

  return parsedLogs;
}

async function sendMessage(page, message) {
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
}

async function loadPrompt() {
  try {
    const promptFile = 'prompt.txt';
    const prompt = await fs.promises.readFile(promptFile, 'utf-8');
    return prompt.trim();
  } catch (error) {
    console.error('读取提示词文件时发生错误:', error);
    return '';
  }
}

async function processMessages(page) {
  // 每20分钟点击一次按钮
  //setInterval(() => clickButton(page), 1200000);

  try {
    const chatLogs = await getChatLogs(page);
    const lastLog = chatLogs[chatLogs.length - 1];

    if (lastLog.name !== '流霜黯淡(npc小马)') {
      await page.keyboard.press('0');
      await page.keyboard.press('8');
      console.log('Pressed key 0');
      const lastTenLogs = chatLogs.slice(-10);
      const message = lastTenLogs.map(log => `[${log.name}]: ${log.message}`).join('\n');

      // 从文件中加载提示词
      const prompt = await loadPrompt();

      // 添加提示词
      const promptedMessage = prompt + '\n' + message;

      console.log('发送到ChatGPT的消息内容:');
      console.log(promptedMessage);

      // 连接到 ChatGPT 页面
      const chatgptBrowserWSEndpoint = await getWSEndpoint(9223); // 替换为 ChatGPT 的端口号
      const chatgptBrowser = await puppeteer.connect({
        browserWSEndpoint: chatgptBrowserWSEndpoint.replace('http://', 'ws://'),
        defaultViewport: null,
      });
      const chatgptPages = await chatgptBrowser.pages();
      const chatgptPage = chatgptPages[0];

      // 在 ChatGPT 页面中输入消息并获取回复
      await chatgptPage.type('#prompt-textarea', promptedMessage);
      await chatgptPage.click('button[data-testid="send-button"]');
      await chatgptPage.waitForSelector('[data-testid^="conversation-turn-"]:last-of-type .markdown');
      await new Promise(resolve => setTimeout(resolve, 8000));

      const reply = await chatgptPage.evaluate(() => {
        return document.querySelector('[data-testid^="conversation-turn-"]:last-of-type .markdown').innerText;
      });

      console.log('ChatGPT的响应内容:');
      console.log(reply);

      // 将内容按照中文句号分段
      const segments = reply.split(/[。！？]/);

      // 逐段发送消息
      for (const segment of segments) {
        if (segment.trim() !== '') {
          await sendMessage(page, segment.trim() + '。');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      await chatgptBrowser.disconnect();
      await page.keyboard.press('8');
    }
  } catch (error) {
    console.error('发生错误:', error);
  }

  setTimeout(() => processMessages(page), 3000);
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