//用于自动重连的脚本，每20秒查找一次safe chinese按钮，找到就点
const puppeteer = require('puppeteer');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const data = await res.json();
  const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
  return browserWSEndpoint;
}

async function clickPlayButton(page) {
  const buttonSelector = '.btn-lg.btn-success';
  
  try {
    await page.waitForSelector(buttonSelector, { timeout: 20000 });
    
    const buttonText = await page.evaluate((selector) => {
      const buttonElement = document.querySelector(selector);
      return buttonElement ? buttonElement.textContent.trim() : '';
    }, buttonSelector);
    
    if (buttonText.includes('Play on Safe Chinese')) {
      await page.click(buttonSelector);
      console.log('Clicked on "Play on Safe Chinese" button');
    } else {
      console.log('"Play on Safe Chinese" button not found');
    }
  } catch (error) {
    console.error('Error occurred while clicking "Play on Safe Chinese" button:', error);
  }
}

(async () => {
  try {
    const browserWSEndpoint = await getWSEndpoint();
    console.log('Connecting to browser:', browserWSEndpoint);

    const browser = await puppeteer.connect({
      browserWSEndpoint: browserWSEndpoint.replace('http://', 'ws://'),
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0];
    console.log('Connected to page:', page.url());

    setInterval(async () => {
      await clickPlayButton(page);
    }, 20000);
  } catch (error) {
    console.error('Error occurred:', error);
  }
})();