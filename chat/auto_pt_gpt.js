//使用chatgpt网页版来驱动聊天机器人的脚本
const { clickButton, getWSEndpoint, getChatLogs, sendMessage, findAndClickSendButton, sendMessageToChatGPT } = require('../common.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function loadPrompt() {
  try {
    const promptFile = 'prompt.txt';
    const prompt = await fs.promises.readFile(promptFile, 'utf-8');
    return prompt.trim();
  } catch (error) {
    console.error('读取提示词文件时发生错误:', error);
    return '';
  }
}

async function processMessages(page) {
  try {
    const chatLogs = await getChatLogs(page);
    const lastLog = chatLogs[chatLogs.length - 1];

    if (lastLog.name !== '流霜黯淡(npc小马)') {
      await page.keyboard.press('9');
      await page.keyboard.press('8');
      await page.keyboard.press('7');
      console.log('Pressed key 9');
      const lastTenLogs = chatLogs.slice(-1);
      const message = lastTenLogs.map(log => `[${log.name}]: ${log.message}`).join('\n');

      // 从文件中加载提示词
      const prompt = await loadPrompt();

      // 添加提示词
      const promptedMessage = prompt + '\n' + message;

      console.log('发送到ChatGPT的消息内容:');
      console.log(promptedMessage);

      await sendMessageToChatGPT(page, promptedMessage);
    }
  } catch (error) {
    console.error('发生错误:', error);
  }

  setTimeout(() => processMessages(page), 1000);
}

(async () => {
  try {
    const browserWSEndpoint = await getWSEndpoint(9222);
    console.log('连接到浏览器:', browserWSEndpoint);

    const browser = await puppeteer.connect({
      browserWSEndpoint: browserWSEndpoint.replace('http://', 'ws://'),
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0];
    console.log('已连接到页面:', page.url());

    await processMessages(page);
  } catch (error) {
    console.error('发生错误:', error);
  }
})();