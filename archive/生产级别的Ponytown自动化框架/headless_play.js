#!/usr/bin/env node
/**
 * 🤖 Ponytown无头自动化脚本
 *
 * 前提：必须先运行 first_login.js 手动登录一次
 * 然后就可以使用此脚本进行无头自动化了
 */

const puppeteer = require('puppeteer');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'browser_data');
const PONYTOWN_URL = 'https://pony.town/';

// 工具函数
async function getChatMessages(page) {
  try {
    const messages = await page.evaluate(() => {
      const chatLogElement = document.querySelector('.chat-log-scroll-inner');
      if (!chatLogElement) return [];

      const chatLines = chatLogElement.innerText.split('\n').filter(line => line.trim());
      return chatLines.map(line => {
        const match = line.match(/^(\d{2}:\d{2})\[(.+?)\]\s*(.*)$/);
        if (match) {
          return {
            time: match[1],
            player: match[2],
            message: match[3]
          };
        }
        return null;
      }).filter(msg => msg !== null);
    });
    return messages;
  } catch (error) {
    return [];
  }
}

async function sendMessage(page, message) {
  try {
    const isChatBoxOpen = await page.evaluate(() => {
      const chatBox = document.querySelector('chat-box .chat-box');
      return chatBox && chatBox.offsetParent !== null;
    });

    if (!isChatBoxOpen) {
      await page.click('chat-box .chat-open-button');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await page.type('chat-box .chat-box .chat-textarea', message);
    await page.evaluate(() => {
      const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
      if (sendButton) sendButton.click();
    });

    console.log(`💬 已发送: ${message}`);
    return true;
  } catch (error) {
    console.error('发送消息失败:', error.message);
    return false;
  }
}

async function isInGame(page) {
  try {
    return await page.evaluate(() => {
      return !!document.querySelector('chat-box') && !!document.querySelector('canvas');
    });
  } catch {
    return false;
  }
}

// 主函数
async function main() {
  console.log('🦄 Ponytown无头自动化脚本启动中...\n');

  // 检查用户数据目录是否存在
  const fs = require('fs');
  if (!fs.existsSync(USER_DATA_DIR)) {
    console.error('❌ 错误：未找到登录数据！');
    console.error('💡 请先运行: node first_login.js');
    process.exit(1);
  }

  try {
    console.log('🚀 启动无头浏览器...');
    const browser = await puppeteer.launch({
      headless: true,  // 无头模式！
      userDataDir: USER_DATA_DIR,  // 使用保存的登录状态
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,720'
      ]
    });

    console.log('✅ 浏览器已启动（无头模式）');

    const page = await browser.newPage();

    console.log('🌐 访问 Ponytown...');
    await page.goto(PONYTOWN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('⏳ 等待页面加载...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 检查是否被检测
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Access denied')) {
      console.error('❌ 检测到反自动化拦截');
      console.error('💡 提示：Ponytown在无头模式下可能仍会被检测');
      console.error('   建议使用有头模式或CDP连接方式');
      await browser.close();
      process.exit(1);
    }

    // 检查是否在游戏中
    const inGame = await isInGame(page);
    if (!inGame) {
      console.log('⚠️  似乎未自动进入游戏');
      console.log('💡 可能需要重新手动登录');

      // 打印页面内容帮助调试
      console.log('\n页面内容:');
      console.log(pageText.substring(0, 500));

      await browser.close();
      process.exit(1);
    }

    console.log('🎮 成功进入游戏！');
    await sendMessage(page, 'Luna无头模式上线！喵～');

    // 监听聊天
    let lastMessageCount = 0;
    const chatCheckInterval = setInterval(async () => {
      const messages = await getChatMessages(page);
      if (messages.length > lastMessageCount) {
        const newMessages = messages.slice(lastMessageCount);
        console.log('\n📨 新消息:');
        newMessages.forEach(msg => {
          console.log(`  [${msg.time}] ${msg.player}: ${msg.message}`);
        });
      }
      lastMessageCount = messages.length;
    }, 3000);

    console.log('\n💬 开始监听聊天...');
    console.log('📝 按 Ctrl+C 退出\n');

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n👋 关闭中...');
      clearInterval(chatCheckInterval);
      await sendMessage(page, 'Luna下线了，再见喵～');
      await browser.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
