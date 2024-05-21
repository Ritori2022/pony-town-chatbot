//用来挂机的脚本，每一分钟按一下数字键0
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




    const screenshotHandle = await page.evaluateHandle(() => {
      const body = document.body;
      const html = document.documentElement;
      const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      const width = Math.max(
        body.scrollWidth,
        body.offsetWidth,
        html.clientWidth,
        html.scrollWidth,
        html.offsetWidth
      );
      return { x: 0, y: 0, width, height };
    });
    
    await page.screenshot({
      path: 'screenshot.png',
      clip: await screenshotHandle.evaluate((rect) => rect),
    });
    
    await screenshotHandle.dispose();

    // 每5分钟按一下数字键0
    setInterval(async () => {
      await page.keyboard.press('0');
      console.log('Pressed key 0');
    }, 1 * 60 * 1000); // 5 minutes in milliseconds



    // 在页面中继续执行其他操作...

  } catch (error) {
    console.error('发生错误:', error);
  }
})();