//连接到浏览器的测试
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
  // 跳转到指定网址
  await page.goto('https://www.baidu.com');
  // 在搜索框中输入内容
  await page.type('#kw', 'hello', {delay: 100});
  // 点击"百度一下"按钮
  await page.click('#su')
  // 等待搜索结果加载完成
  await page.waitForSelector('#content_left');
  // 保存页面截图
  await page.screenshot({ path: 'screenshot.png' });

    console.log('自动化操作完成');

    await browser.disconnect();
  } catch (error) {
    console.error('发生错误:', error);
  }
})();