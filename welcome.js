//有人发言就发送欢迎语，每分钟最多发一次
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

async function sendInitialMessage(page) {
  try {
    await sendMessage(page, '欢迎语模块已重置');
    console.log('已发送初始消息');
  } catch (error) {
    console.error('发送初始消息失败:', error);
  }
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
      console.warn(`跳过无效的聊天记录行: ${line}`);
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
    console.log('已打开聊天框');
  }

  await page.type('chat-box .chat-box .chat-textarea', message);
  console.log(`已输入消息: ${message}`);

  await page.evaluate(() => {
    const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
    sendButton.click();
  });
  console.log('已发送消息');
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
    console.log(`已保存进度: ${index}`);
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
      console.log('进度文件不存在,返回初始进度0');
      return 0;
    } else {
      console.error(`读取进度文件 ${progressFile} 时发生错误:`, error);
      return 0;
    }
  }
}

async function processMessages(page, lastMessage, lastMessageTimestamp) {
  try {
    const ocMessages = await loadOCMessages('oc.txt');
    const progressFile = 'progress.txt';
    let index = await loadProgress(progressFile);
    let position = 0;
    let lastChatTimestamp = Date.now();

    console.log(`加载OC消息: ${ocMessages.length} 条`);
    console.log(`加载进度: ${index}`);

    // 初始化lastMessage和lastMessageTimestamp
    if (!lastMessage || !lastMessageTimestamp) {
      const chatLogs = await getChatLogs(page);
      const lastLog = chatLogs[chatLogs.length - 1];
      lastMessage = lastLog.message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
      lastMessageTimestamp = new Date(`1970-01-01T${lastLog.timestamp}:00Z`).getTime();
      console.log(`初始化最后一条消息: ${lastMessage}`);
      console.log(`初始化最后一条消息时间戳: ${lastMessageTimestamp}`);
    }

    while (index < ocMessages.length) {
      let chatLogs = await getChatLogs(page);
      let lastLog = chatLogs[chatLogs.length - 1];
      let currentTime = new Date().getTime();

      // 检查最后一条消息是否与上次任何人发送的消息相同
      const lastMessageContent = lastLog.message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
      const isLastMessageSame = lastMessageContent === lastMessage;

      console.log(`最后一条消息内容: ${lastMessageContent}`);
      console.log(`是否与上次消息相同: ${isLastMessageSame}`);

      // 检查与最后一条聊天消息的时间间隔是否超过2分钟
      const isLastChatOld = currentTime - lastChatTimestamp > 1 * 60 * 1000;

      console.log(`当前时间: ${currentTime}`);
      console.log(`最后一次聊天时间戳: ${lastChatTimestamp}`);
      console.log(`是否超过2分钟: ${isLastChatOld}`);

      if (isLastChatOld) {
        if (isLastMessageSame) {
          // 如果2分钟没人说话,按数字键6
          await page.keyboard.press('6');
          console.log('已按下数字键6');
        } else {
          // 如果2分钟没人说话后有人开始说话,按数字键5
          await page.keyboard.press('5');
          console.log('已按下数字键5');
          lastMessage = lastMessageContent;
          lastMessageTimestamp = new Date(`1970-01-01T${lastLog.timestamp}:00Z`).getTime();
          lastChatTimestamp = currentTime;
          console.log('检测到新消息,更新最后聊天时间戳');

          while (index < ocMessages.length) {
            const line = ocMessages[index];
            const remainingLine = line.slice(position);
            const nextSentenceEnd = remainingLine.indexOf('。');

            if (nextSentenceEnd !== -1) {
              const message = remainingLine.slice(0, nextSentenceEnd + 1);
              await sendMessage(page, message);
              lastMessage = message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
              lastMessageTimestamp = currentTime;
              position += nextSentenceEnd + 1;

              if (position >= line.length) {
                await saveProgress(progressFile, index + 1);
                index++;
                position = 0;
              }
            } else {
              await sendMessage(page, remainingLine);
              lastMessage = remainingLine.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim();
              lastMessageTimestamp = currentTime;
              await saveProgress(progressFile, index + 1);
              index++;
              position = 0;
            }

            await new Promise(resolve => setTimeout(resolve, 4000)); // 每条消息间隔8秒
          }

          console.log('已发送所有消息');
        }
      } else if (!isLastMessageSame) {
        lastMessage = lastMessageContent;
        lastMessageTimestamp = new Date(`1970-01-01T${lastLog.timestamp}:00Z`).getTime();
        lastChatTimestamp = currentTime;
      }

      await new Promise(resolve => setTimeout(resolve, 3000)); // 每3秒检查一次
    }

    // 所有消息已发送完毕,重置进度
    await saveProgress(progressFile, 0);
    console.log('所有消息已发送完毕,重置进度');
  } catch (error) {
    console.error('发生错误:', error);
  }

  setTimeout(() => processMessages(page, lastMessage, lastMessageTimestamp), 3000);
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

    // 发送初始消息
    await sendInitialMessage(page);

    let lastMessageTimestamp = null;
    await processMessages(page, lastMessageTimestamp);
  } catch (error) {
    console.error('发生错误:', error);
  }
})();