//获取聊天框中所有记录的脚本，打印在控制台上，用于测试获取聊天记录功能
const puppeteer = require('puppeteer');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const data = await res.json();
  // 将 webSocketDebuggerUrl 中的 ws:// 替换为 http://
  const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
  return browserWSEndpoint;
}

(async () => {
  try {
    const browserWSEndpoint = await getWSEndpoint();
    console.log('连接到浏览器:', browserWSEndpoint);

    // 连接到已打开的浏览器
    const browser = await puppeteer.connect({
      browserWSEndpoint: browserWSEndpoint.replace('http://', 'ws://'),
      defaultViewport: null,
    });

    // 获取已打开的页面
    const pages = await browser.pages();
    const page = pages[0];
    console.log('已连接到页面:', page.url());

    // 在页面中继续执行操作
    const chatLogs = await page.evaluate(() => {
        const chatLogElement = document.querySelector('.chat-log-scroll-inner');
        return chatLogElement.innerText;
      });
      
      console.log('聊天记录原始内容:');
      console.log(chatLogs);
      
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
      });
      
      console.log('解析后的聊天记录:');
      console.log(parsedLogs.filter(log => log !== null));

    console.log('自动化操作完成');

    await browser.disconnect();
  } catch (error) {
    console.error('发生错误:', error);
  }
})();