//最小可行自动测试
const puppeteer = require('puppeteer');

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({ headless: false });
  // 打开新页面
  const page = await browser.newPage();
  // 跳转到指定网址
  await page.goto('https://www.baidu.com');
  // 在搜索框中输入内容
  await page.type('#kw', 'Puppeteer', {delay: 100});
  // 点击"百度一下"按钮
  await page.click('#su')
  // 等待搜索结果加载完成
  await page.waitForSelector('#content_left');
  // 保存页面截图
  await page.screenshot({ path: 'screenshot.png' });
  // 关闭浏览器
  // await browser.close();
})();