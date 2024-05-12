//发送聊天到pt
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

// 判断聊天框是否打开
const isChatBoxOpen = await page.evaluate(() => {
  const chatBox = document.querySelector('chat-box .chat-box');
  return chatBox && chatBox.offsetParent !== null;
});

// 如果聊天框关闭,则点击按钮打开聊天框
if (!isChatBoxOpen) {
  await page.click('chat-box .chat-open-button');
}

// 找到输入框并输入消息
await page.type('chat-box .chat-box .chat-textarea', 'Greetings, Mineral Spirit! Its an honor to meet you. Im excited to learn more about the secrets of the earth and the world of minerals. What would you like to share with me today?');

// 点击发送按钮
await page.evaluate(() => {
  const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
  sendButton.click();
});

    console.log('自动化操作完成');

    await browser.disconnect();
  } catch (error) {
    console.error('发生错误:', error);
  }
})();