//每5分钟自动截图一次的脚本
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const data = await res.json();
  const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
  return browserWSEndpoint;
}

function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}-${minutes}`;
}

async function takeScreenshot(page) {
  const screenshotFolder = path.join(__dirname, 'screenshot');
  if (!fs.existsSync(screenshotFolder)) {
    fs.mkdirSync(screenshotFolder);
  }

  const dateTime = getFormattedDateTime();
  const screenshotPath = path.join(screenshotFolder, `${dateTime}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`截图已保存: ${screenshotPath}`);
}

async function startScreenshotLoop(page) {
  try {
    await takeScreenshot(page);
    setTimeout(() => startScreenshotLoop(page), 5 * 60 * 1000);
  } catch (error) {
    console.error('截图时发生错误:', error);
    setTimeout(() => startScreenshotLoop(page), 5 * 60 * 1000);
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

    startScreenshotLoop(page);
  } catch (error) {
    console.error('发生错误:', error);
  }
})();