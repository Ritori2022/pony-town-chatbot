const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const siliconflow = require('@api/siliconflow');

// 从环境变量中读取配置
const NPC_NAME = process.env.NPC_NAME || 'ai猫娘';
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || '你是一只猫娘，你使用可爱的语气回复消息。你总是使用"喵"做为结尾。你总是以"主人"称呼用户。';
const API_KEY = process.env.API_KEY;

siliconflow.auth(API_KEY);

// 确保CSV文件存在
const CSV_FILE_PATH = 'chat_logs.csv';
if (!fs.existsSync(CSV_FILE_PATH)) {
  fs.writeFileSync(CSV_FILE_PATH, 'timestamp,name,message\n');
}

const csvWriter = createCsvWriter({
  path: CSV_FILE_PATH,
  header: [
    {id: 'timestamp', title: 'TIMESTAMP'},
    {id: 'name', title: 'NAME'},
    {id: 'message', title: 'MESSAGE'}
  ],
  append: true
});

let prevLogs = [];
let isSpeaking = false;

async function getChatLogs(page) {
  return await page.evaluate(() => {
    const chatLogElement = document.querySelector('.chat-log-scroll-inner');
    return chatLogElement ? chatLogElement.innerText : '';
  });
}

function parseChatLogs(chatLogs) {
  const chatLines = chatLogs.split('\n').filter(line => line.trim() !== '');
  return chatLines.map(line => {
    const match = line.match(/^(\d{2}:\d{2})\[(.+?)\]\s*(.*)$/);
    return match ? { timestamp: match[1], name: match[2], message: match[3] } : null;
  }).filter(log => log !== null);
}

async function sendMessage(page, message) {
  await page.evaluate((msg) => {
    const chatBox = document.querySelector('chat-box .chat-box');
    if (!chatBox || chatBox.offsetParent === null) {
      document.querySelector('chat-box .chat-open-button').click();
    }
    const textarea = document.querySelector('chat-box .chat-box .chat-textarea');
    const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
    textarea.value = msg;
    sendButton.click();
  }, message);
}

async function sendMessageToSiliconCloud(messages) {
  try {
    const { data } = await siliconflow.chatCompletions({
      model: 'Qwen/Qwen2-7B-Instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ]
    });
    return data.choices[0].message.content;
  } catch (error) {
    console.error('调用 SiliconCloud API 失败:', error);
    return null;
  }
}

async function processNewLogs(page, newLogs) {
  if (newLogs.length > 0) {
    console.log('发现新的聊天记录:', newLogs);
    await csvWriter.writeRecords(newLogs);

    const lastLog = newLogs[newLogs.length - 1];
    if (lastLog && lastLog.name !== NPC_NAME) {
      await page.keyboard.press('9');
      await page.keyboard.press('8');
      await page.keyboard.press('7');
      console.log('按下了按键 9, 8, 7');

      const mergedMessages = prevLogs.reduce((acc, log) => {
        if (log.name === NPC_NAME) {
          if (acc.length > 0 && acc[acc.length - 1].role === 'assistant') {
            acc[acc.length - 1].content += ' ' + log.message;
          } else {
            acc.push({ role: 'assistant', content: log.message });
          }
        } else {
          acc.push({ role: 'user', content: `[${log.name}]: ${log.message}` });
        }
        return acc;
      }, []);

      console.log('发送到SiliconCloud的消息内容:', mergedMessages);

      try {
        const reply = await Promise.race([
          sendMessageToSiliconCloud(mergedMessages),
          new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), 20000))
        ]);

        if (reply) {
          console.log('SiliconCloud的响应内容:', reply);
          await speakReply(page, reply);
        }
      } catch (error) {
        console.error('处理SiliconCloud响应时发生错误:', error);
      }
    }
  } else {
    console.log('未发现新的聊天记录');
  }
}

async function speakReply(page, reply) {
  const segments = reply.split(/([。！？~])/);
  await page.keyboard.press('7');
  await page.keyboard.press('9');
  
  for (let i = 0; i < segments.length; i += 2) {
    let message = segments[i];
    if (i + 1 < segments.length) {
      message += segments[i + 1];
    }
    if (message.trim() !== '') {
      while (isSpeaking) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      isSpeaking = true;
      await sendMessage(page, message.trim());
      await new Promise(resolve => setTimeout(resolve, 3000));
      isSpeaking = false;
    }
  }
  
  await page.keyboard.press('8');
  await page.keyboard.press('9');
}

async function monitorChat(page) {
  while (true) {
    try {
      const chatLogs = await getChatLogs(page);
      const parsedLogs = parseChatLogs(chatLogs);

      const newLogs = parsedLogs.filter(log => {
        return !prevLogs.some(prevLog => 
          prevLog.timestamp === log.timestamp &&
          prevLog.name === log.name &&
          prevLog.message === log.message
        );
      });

      if (newLogs.length > 0) {
        processNewLogs(page, newLogs).catch(console.error);
        prevLogs = parsedLogs;
      }
    } catch (error) {
      console.error('监控聊天时发生错误:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

module.exports = {
  monitorChat
};