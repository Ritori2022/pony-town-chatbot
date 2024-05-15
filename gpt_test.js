const puppeteer = require('puppeteer');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9223/json/version');
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

    // 获取已打开的页面列表
    const pages = await browser.pages();

    // 选择第一个页面
    const page = pages[0];
    console.log('已连接到页面:', page.url());

    // 检查页面是否为 ChatGPT
    if (!page.url().startsWith('https://chatgpt.com/')) {
      throw new Error('当前页面不是 ChatGPT');
    }

    // 在页面中继续执行操作
    // 找到输入框并输入消息
    await page.type('#prompt-textarea', '你好,ChatGPT!');

    // 找到发送按钮并点击
    await page.click('button[data-testid="send-button"]');

    // 等待回复出现
    await page.waitForSelector('[data-testid^="conversation-turn-"]:last-of-type .markdown');

    // 再等待5秒,确保回复完整加载
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 获取 ChatGPT 的最新回复
    let reply = await page.evaluate(() => {
      return document.querySelector('[data-testid^="conversation-turn-"]:last-of-type .markdown').innerText;
    });

    console.log('ChatGPT 最新回复:', reply);

    // 可以继续发送消息和获取回复...

    console.log('自动化操作完成');

    await browser.disconnect();
  } catch (error) {
    console.error('发生错误:', error);
  }
})();