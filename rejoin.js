const puppeteer = require('puppeteer');

async function getWSEndpoint() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const data = await res.json();
  const browserWSEndpoint = data.webSocketDebuggerUrl.replace('ws://', 'http://');
  return browserWSEndpoint;
}

async function clickSafeChinese(page) {

    
    try {
      await page.waitForSelector(spanSelector, { timeout: 20000 });
      
      const spanText = await page.evaluate((selector) => {
        const spanElement = document.querySelector(selector);
        return spanElement ? spanElement.textContent : '';
      }, spanSelector);
  
      if (spanText === 'Safe Chinese') {
        await page.click(spanSelector);
        console.log('Clicked on "Safe Chinese"');
      } else {
        console.log('"Safe Chinese" not found');
      }
    } catch (error) {
      console.error('Error occurred while clicking "Safe Chinese":', error);
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
      await clickSafeChinese(page);
    }, 20000);
  } catch (error) {
    console.error('Error occurred:', error);
  }
})();