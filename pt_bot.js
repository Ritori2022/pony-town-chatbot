require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const chatProcessor = require('./chat_processor');

// 从环境变量中读取配置
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_PASSWORD = process.env.GITHUB_PASSWORD;
const HEADLESS = process.env.HEADLESS === '0' ? false : true;
const RESOLUTION = process.env.RESOLUTION ? process.env.RESOLUTION.split('x').map(Number) : [1600, 900];

async function login(page) {
  await page.goto('https://pony.town/');
  console.log('成功访问 Pony.town');

  await page.click('button.btn-dark[title="Sign in using GitHub"]');
  await page.waitForNavigation();
  console.log('成功点击 GitHub 登录按钮');

  await page.type('#login_field', GITHUB_USERNAME);
  await page.type('#password', GITHUB_PASSWORD);
  console.log('成功输入 GitHub 登录信息');

  await page.click('.js-sign-in-button');
  await page.waitForNavigation();
  console.log('成功点击登录按钮');

  await page.waitForFunction(
    () => {
      const button = document.querySelector('.js-oauth-authorize-btn');
      return button && !button.disabled;
    },
    { timeout: 60000 }
  );
  console.log('成功等待授权按钮');

  await page.click('.js-oauth-authorize-btn');
  await page.waitForNavigation({ timeout: 60000 });
  console.log('成功点击授权按钮');

  await clickPlayButton(page);
}

async function clickPlayButton(page) {
  const buttonSelector = '.btn-lg.btn-success';
  
  try {
    await page.waitForSelector(buttonSelector, { timeout: 5000 });
    
    const buttonText = await page.evaluate((selector) => {
      const buttonElement = document.querySelector(selector);
      return buttonElement ? buttonElement.textContent.trim() : '';
    }, buttonSelector);
    
    if (buttonText.includes('Play on Safe Chinese')) {
      await page.click(buttonSelector);
      console.log('点击了 "Play on Safe Chinese" 按钮');
    } else {
      console.log('未找到 "Play on Safe Chinese" 按钮');
    }
  } catch (error) {
    console.error('点击 "Play on Safe Chinese" 按钮时发生错误:', error);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: RESOLUTION[0],
      height: RESOLUTION[1]
    }
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: RESOLUTION[0], height: RESOLUTION[1] });
    
    await login(page);
    console.log('登录成功，开始监控聊天');
    
    // 开始监控聊天
    chatProcessor.monitorChat(page);

    // 每20秒检查一次重连按钮
    setInterval(async () => {
      await clickPlayButton(page);
    }, 20000);

    // 每分钟按一次0来保持afk挂机
    setInterval(async () => {
      await page.keyboard.press('0');
      console.log('按下了0键以保持AFK状态');
    }, 60000);

  } catch (error) {
    console.error('发生错误:', error);
    await browser.close();
  }
})();