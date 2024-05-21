//用于将chatgpt网页版从异常错误中恢复
const puppeteer = require('puppeteer');

async function getWSEndpoint(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`);
  const data = await res.json();
  return data.webSocketDebuggerUrl;
}

async function clickButtonAndSendMessage(page, buttonSelector, message) {
  try {
    await page.waitForSelector(buttonSelector, { timeout: 5000 });
    await page.click(buttonSelector);
    console.log('已点击按钮');

    await new Promise(resolve => setTimeout(resolve, 10000));

    await page.type('chat-box .chat-box .chat-textarea', message);
    await page.evaluate(() => {
      const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
      sendButton.click();
    });
    console.log('已发送消息到 Ponytown');
  } catch (error) {
    console.error('未找到按钮或发送消息失败:', error);
  }
}

(async () => {
  try {
    const browserWSEndpoint = await getWSEndpoint(9223);
    const browser = await puppeteer.connect({ browserWSEndpoint });
    const pages = await browser.pages();
    const page = pages[0]; // 假设 Ponytown 窗口是第一个页面

    const buttonSelector = 'button.btn.relative.btn-primary.m-auto';
    const message = '守秘人模块已重置';

    while (true) {
      await clickButtonAndSendMessage(page, buttonSelector, message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } catch (error) {
    console.error('连接到浏览器失败:', error);
  }
})();