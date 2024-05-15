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

async function loadLvyeMessages(lvyeFile) {
  try {
    const content = await fs.promises.readFile(lvyeFile, 'utf-8');
    return content.trim().split('\n');
  } catch (error) {
    console.error(`读取绿叶文件 ${lvyeFile} 时发生错误:`, error);
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

async function processMessages(page) {
  try {
    const lvyeMessages = await loadLvyeMessages('lvye.txt');
    const progressFile = 'progress.txt';
    let index = await loadProgress(progressFile);
    let position = 0;

    const sendNextMessage = async () => {
      if (index < lvyeMessages.length) {
        const line = lvyeMessages[index];
        const remainingLine = line.slice(position);
        const nextSentenceEnd = remainingLine.indexOf('。');

        if (nextSentenceEnd !== -1) {
          const message = remainingLine.slice(0, nextSentenceEnd + 1);
          await sendMessage(page, message);
          console.log(`已发送消息: ${message}`);
          position += nextSentenceEnd + 1;

          if (position >= line.length) {
            await saveProgress(progressFile, index + 1);
            index++;
            position = 0;
          }
        } else {
          await sendMessage(page, remainingLine);
          console.log(`已发送消息: ${remainingLine}`);
          await saveProgress(progressFile, index + 1);
          index++;
          position = 0;
        }
      } else {
        console.log('所有消息已发送完毕,从头开始');
        index = 0; // 重置index为0,从头开始
        position = 0;
      }
      setTimeout(sendNextMessage, 10000); // 10秒后发送下一条消息
    };

    sendNextMessage(); // 开始发送消息
  } catch (error) {
    console.error('发生错误:', error);
  }
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

    await processMessages(page);
  } catch (error) {
    console.error('发生错误:', error);
  }
})();