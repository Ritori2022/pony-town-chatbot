//十分钟没人搭话就自言自语，从api即时生成
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

async function runGPT(message) {
  return new Promise((resolve, reject) => {
    const process = spawn('python3', ['gpt.py', message]);
    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`gpt.py exited with code ${code}`));
      }
    });
  });
}

async function loadPrompt(promptFile) {
  try {
    const prompt = await fs.promises.readFile(promptFile, 'utf-8');
    return prompt.trim();
  } catch (error) {
    console.error(`读取提示词文件 ${promptFile} 时发生错误:`, error);
    return '';
  }
}

async function processMessages(page, lastMessageTimestamp) {
  try {
    const chatLogs = await getChatLogs(page);
    const lastLog = chatLogs[chatLogs.length - 1];

    const currentTime = new Date().getTime();
    if (!lastMessageTimestamp || currentTime - lastMessageTimestamp > 10 * 60 * 1000) {
      // 从文件中加载introduce提示词
      const introducePrompt = await loadPrompt('prompt_introduce.txt');

      console.log('发送到API的消息内容:');
      console.log(introducePrompt);

      const reply = await Promise.race([
        runGPT(introducePrompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('API请求超时')), 60000))
      ]);

      console.log('API的响应内容:');
      console.log(reply);

      // 提取assistant之后的内容
      const content = reply.split('assistant')[1].trim();

      // 将内容分段,每70个字符一段        
      const segments = [];
      let currentSegment = '';
      content.split('').forEach(char => {
        currentSegment += char;
        if (currentSegment.length >= 70) {
          segments.push(currentSegment);
          currentSegment = '';
        }
      });
      if (currentSegment) {
        segments.push(currentSegment);
      }

      // 逐段发送消息
      for (const segment of segments) {
        await sendMessage(page, segment);
      }

      lastMessageTimestamp = currentTime;
    } else if (lastLog.name !== '流霜黯淡(npc角色扮演者)') {
      const lastTenLogs = chatLogs.slice(-20);
      const message = lastTenLogs.map(log => `[${log.name}]: ${log.message}`).join('\n');

      // 从文件中加载chat提示词
      const chatPrompt = await loadPrompt('prompt.txt');

      // 添加提示词      
      const promptedMessage = chatPrompt + '\n' + message;

      console.log('发送到API的消息内容:');
      console.log(promptedMessage);

      const reply = await Promise.race([
        runGPT(promptedMessage),
        new Promise((_, reject) => setTimeout(() => reject(new Error('API请求超时')), 60000))
      ]);

      console.log('API的响应内容:');      
      console.log(reply);

      // 提取assistant之后的内容
      const content = reply.split('assistant')[1].trim();

      // 将内容分段,每70个字符一段
      const segments = [];
      let currentSegment = '';
      content.split('').forEach(char => {
        currentSegment += char;
        if (currentSegment.length >= 70) {
          segments.push(currentSegment);
          currentSegment = '';
        }
      });
      if (currentSegment) {
        segments.push(currentSegment);
      }

      // 逐段发送消息
      for (const segment of segments) {
        await sendMessage(page, segment);
      }
    }
  } catch (error) {
    console.error('发生错误:', error);
  }

  setTimeout(() => processMessages(page, lastMessageTimestamp), 10000);
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