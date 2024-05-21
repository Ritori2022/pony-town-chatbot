//使用llama3-7b api 来驱动pt聊天机器人的自动聊天脚本
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const { spawn } = require('child_process');

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

async function processMessages(page) {
    try {
      const chatLogs = await getChatLogs(page);
      const lastLog = chatLogs[chatLogs.length - 1];
  
      if (lastLog.name !== '矿洞精灵(智能代理测试中)') {
        const lastTenLogs = chatLogs.slice(-10);
        const message = lastTenLogs.map(log => `[${log.name}]: ${log.message}`).join('\n');
  
        // 添加提示词
        const promptedMessage = '请只生成中文内容,请不要重复聊天记录中的内容做为生成的内容。我正在进行角色扮演游戏,请你充当角色扮演者,使用中文回答。在小马宝莉的世界观中对聊天记录中的相关内容进行60个汉字以内的回复。你扮演的角色是矿洞精灵：矿洞中的水晶赋予了你预见未来的神奇能力。小马们经常来向你咨询,寻求人生的指引。你用智慧引导小马们走向光明。聊天记录如下：\n' + message;
  
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
  
        // 将内容分段,每60个字符一段
        const segments = [];
        let currentSegment = '';
        content.split('').forEach(char => {
          currentSegment += char;
          if (currentSegment.length >= 60) {
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
  
    setTimeout(() => processMessages(page), 10000);
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