//每分钟获取聊天记录的脚本,加入到chat_logs.csv中
const puppeteer = require('puppeteer');
const fs = require('fs');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const data = await res.json();
  const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
  return browserWSEndpoint;
}

async function getChatLogs(page) {
  return await page.evaluate(() => {
    const chatLogElement = document.querySelector('.chat-log-scroll-inner');
    return chatLogElement.innerText;
  });
}

function parseChatLogs(chatLogs) {
  const chatLines = chatLogs.split('\n').filter(line => line.trim() !== '');
  return chatLines.map(line => {
    const match = line.match(/^(\d{2}:\d{2})\[(.+?)\]\s*(.*)$/);
    if (match) {
      const [_, timestamp, name, message] = match;
      return { timestamp, name, message };
    } else {
      console.warn(`Skipping invalid chat log line: ${line}`);
      return null;
    }
  }).filter(log => log !== null);
}

function saveNewLogsToCSV(newLogs, csvFilePath) {
  const csvHeader = 'Timestamp,Name,Message\n';
  const csvData = newLogs.map(log => `${log.timestamp},${log.name},${log.message}`).join('\n');
  
  if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, csvHeader + csvData);
  } else {
    fs.appendFileSync(csvFilePath, '\n' + csvData);
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

    let prevLogs = [];

    setInterval(async () => {
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
        console.log('发现新的聊天记录:', newLogs);
        saveNewLogsToCSV(newLogs, 'chat_logs.csv');
        prevLogs = parsedLogs;
      }
    }, 10000); // 每隔60秒（1分钟）获取一次聊天记录

  } catch (error) {
    console.error('发生错误:', error);
  }
})();