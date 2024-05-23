//三分钟没人搭话就自言自语,从oc.txt中每分钟读一句
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
      return content.trim().split('\n');
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
  
  async function processMessages(page, lastSentMessage, lastSentTimestamp) {
    try {
      const ocMessages = await loadOCMessages('oc_liushuang.txt');
      const progressFile = 'progress.txt';
      let index = await loadProgress(progressFile);
      let position = 0;
      let lastMessage = '';
      let sameMessageCount = 0;
  
      // 初始化lastSentMessage和lastSentTimestamp
      if (!lastSentMessage || !lastSentTimestamp) {
        const chatLogs = await getChatLogs(page);
        const lastLog = chatLogs[chatLogs.length - 1];
        lastSentMessage = lastLog.message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
        lastSentTimestamp = new Date(`1970-01-01T${lastLog.timestamp}:00Z`).getTime();
      }
  
      while (index < ocMessages.length) {
        let chatLogs = await getChatLogs(page);
        let lastLog = chatLogs[chatLogs.length - 1];
        let currentTime = new Date().getTime();
  
        // 检查最后一条消息是否是上次发送的消息
        const lastMessageContent = lastLog.message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
        const isLastMessageSent = lastMessageContent === lastSentMessage;
  
        if (!isLastMessageSent) {
          if (lastMessageContent === lastMessage) {
            sameMessageCount++;
            if (sameMessageCount < 2) {
              console.log(`连续检测到相同消息,当前次数: ${sameMessageCount}`);
              await new Promise(resolve => setTimeout(resolve, 60000));
              continue;
            }
          } else {
            lastMessage = lastMessageContent;
            sameMessageCount = 1;
            console.log('检测到新的消息,重置连续检测次数');
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
        }
  
        // 检查与上次发送消息的时间间隔是否超过2分钟
        const isLastSentMessageOld = currentTime - lastSentTimestamp > 1 * 60 * 1000;
  
        if (isLastMessageSent || (sameMessageCount >= 2 && isLastSentMessageOld)) {
          const line = ocMessages[index];
          const remainingLine = line.slice(position);
          const nextSentenceEnd = remainingLine.indexOf('。');
  
          if (nextSentenceEnd !== -1) {
            const message = remainingLine.slice(0, nextSentenceEnd + 1);
            await sendMessage(page, message);
            lastSentMessage = message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
            lastSentTimestamp = currentTime;
            position += nextSentenceEnd + 1;
  
            if (position >= line.length) {
              await saveProgress(progressFile, index + 1);
              index++;
              position = 0;
            }
          } else {
            await sendMessage(page, remainingLine);
            lastSentMessage = remainingLine.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
            lastSentTimestamp = currentTime;
            await saveProgress(progressFile, index + 1);
            index++;
            position = 0;
          }
  
          console.log('已发送消息,等待1分钟后继续');
          await new Promise(resolve => setTimeout(resolve, 60000));
          lastMessage = '';
          sameMessageCount = 0;
        } else {
          console.log('最后一条消息不是上次发送的消息,且与上次发送消息的时间间隔未超过2分钟,暂停发送');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
  
      // 所有消息已发送完毕,重置进度
      await saveProgress(progressFile, 0);
    } catch (error) {
      console.error('发生错误:', error);
    }
  
    setTimeout(() => processMessages(page, lastSentMessage, lastSentTimestamp), 60000);
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