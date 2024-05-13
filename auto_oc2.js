//十分钟没人搭话就自言自语,从oc.txt中每分钟读一句
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
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

async function loadOCMessages(ocFile) {
    try {
      const content = await fs.promises.readFile(ocFile, 'utf-8');
      return content.trim().split(/(?<=[.!?])\s+/);
    } catch (error) {
      console.error(`读取OC文件 ${ocFile} 时发生错误:`, error);
      return [];
    }
  }
  
  async function saveProgress(progressFile, index) {
    try {
      await fs.promises.writeFile(progressFile, index.toString());
    } catch (error) {
      console.error(`保存进度到文件 ${progressFile} 时发生错误:`, error);
    }
  }
  
  async function loadProgress(progressFile) {
    try {
      const content = await fs.promises.readFile(progressFile, 'utf-8');
      return parseInt(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 如果文件不存在,返回初始进度0
        return 0;
      } else {
        console.error(`读取进度文件 ${progressFile} 时发生错误:`, error);
        return 0;
      }
    }
  }
  
  async function processMessages(page, lastSentMessage, lastMessageTimestamp) {
    try {
      const chatLogs = await getChatLogs(page);
      const lastLog = chatLogs[chatLogs.length - 1];
      const currentTime = new Date().getTime();
  
      if (lastLog.message === lastSentMessage || (currentTime - lastMessageTimestamp > 3 * 60 * 1000)) {
        const ocMessages = await loadOCMessages('oc.txt');
        const progressFile = 'progress.txt';
        let index = await loadProgress(progressFile);
  
        while (index < ocMessages.length) {
          const message = ocMessages[index];
          await sendMessage(page, message);
          lastSentMessage = message;
          lastMessageTimestamp = currentTime; // 更新lastMessageTimestamp为当前时间
          await saveProgress(progressFile, index);
          index++;
  
          console.log('等待1分钟后继续发送下一条消息');
          await new Promise(resolve => setTimeout(resolve, 60000));
  
          const newChatLogs = await getChatLogs(page);
          if (newChatLogs.length > chatLogs.length) {
            // 有新的发言,更新最后一条消息的时间戳
            lastMessageTimestamp = currentTime; // 更新lastMessageTimestamp为当前时间
            break;
          }
        }
  
        if (index === ocMessages.length) {
          // 所有消息已发送完毕,重置进度
          await saveProgress(progressFile, 0);
        }
      } else {
        console.log('最后一条消息不是上次发送的消息,且距离上次发送时间未超过3分钟,暂停发送');
      }
    } catch (error) {
      console.error('发生错误:', error);
    }
  
    setTimeout(() => processMessages(page, lastSentMessage, lastMessageTimestamp), 60000);
  }

(async () => {
  try {
    const browserWSEndpoint = await getWSEndpoint();
    console.log('连接到浏览器:', browserWSEndpoint);

    const browser = await puppeteer.connect({
      browserWSEndpoint: browserWSEndpoint.replace('http://', 'ws://'),
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0];
    console.log('已连接到页面:', page.url());

    let lastMessageTimestamp = null;
    await processMessages(page, lastMessageTimestamp);
  } catch (error) {
    console.error('发生错误:', error);
  }
})();