#!/usr/bin/env node
/**
 * 🎮 Ponytown游戏交互脚本
 *
 * 连接到已运行的浏览器（端口9222）
 * 与Ponytown游戏进行交互
 */

const puppeteer = require('puppeteer');

// 配置
const DEBUG_PORT = 9222;
const CHECK_INTERVAL = 5000; // 每5秒检查一次聊天

// 工具函数
async function getWSEndpoint(port) {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const data = await res.json();
      return data.webSocketDebuggerUrl;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`无法连接到浏览器端口 ${port}。请先运行 start_browser.js`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function getChatMessages(page) {
  try {
    const messages = await page.evaluate(() => {
      const chatLogElement = document.querySelector('.chat-log-scroll-inner');
      if (!chatLogElement) return [];

      const chatText = chatLogElement.innerText;
      const lines = chatText.split('\n').filter(line => line.trim());

      return lines.map(line => {
        // 格式: HH:MM[玩家名] 消息内容
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
    console.error('获取聊天记录失败:', error.message);
    return [];
  }
}

async function sendMessage(page, message) {
  try {
    // 检查聊天框是否打开
    const isChatBoxOpen = await page.evaluate(() => {
      const chatBox = document.querySelector('chat-box .chat-box');
      return chatBox && chatBox.offsetParent !== null;
    });

    // 如果聊天框未打开，打开它
    if (!isChatBoxOpen) {
      await page.click('chat-box .chat-open-button');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 输入消息
    await page.type('chat-box .chat-box .chat-textarea', message);

    // 点击发送按钮
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
    const inGame = await page.evaluate(() => {
      // 检查游戏画面元素是否存在
      return !!document.querySelector('chat-box') &&
             !!document.querySelector('canvas');
    });
    return inGame;
  } catch {
    return false;
  }
}

// 主函数
async function main() {
  console.log('🦄 Ponytown游戏交互脚本启动中...\n');

  try {
    // 连接到浏览器
    console.log('🔌 连接到浏览器...');
    const browserWSEndpoint = await getWSEndpoint(DEBUG_PORT);
    const browser = await puppeteer.connect({
      browserWSEndpoint,
      defaultViewport: null
    });

    console.log('✅ 已连接到浏览器');

    // 获取页面
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('pony.town')) || pages[0];

    console.log(`📄 当前页面: ${page.url()}`);

    // 检查是否在游戏中
    const inGame = await isInGame(page);
    if (!inGame) {
      console.log('⚠️  警告：似乎还未进入游戏');
      console.log('   请在浏览器中登录并进入游戏后，再运行此脚本');
      await browser.disconnect();
      process.exit(0);
    }

    console.log('🎮 已进入游戏！');
    console.log('');
    console.log('📝 可用命令:');
    console.log('  - 自动监听聊天（每5秒）');
    console.log('  - 输入文本并回车发送消息');
    console.log('  - 输入 /quit 退出');
    console.log('');

    // 发送欢迎消息
    await sendMessage(page, 'Luna上线啦！喵～');

    // 记录上次的聊天记录数量
    let lastMessageCount = 0;

    // 定时检查聊天
    const chatCheckInterval = setInterval(async () => {
      const messages = await getChatMessages(page);

      if (messages.length > lastMessageCount) {
        // 有新消息
        const newMessages = messages.slice(lastMessageCount);
        console.log('\n📨 新消息:');
        newMessages.forEach(msg => {
          console.log(`  [${msg.time}] ${msg.player}: ${msg.message}`);
        });
        console.log('');
      }

      lastMessageCount = messages.length;
    }, CHECK_INTERVAL);

    // 处理用户输入
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (input) => {
      const text = input.trim();

      if (text === '/quit') {
        clearInterval(chatCheckInterval);
        await sendMessage(page, 'Luna下线啦，再见喵～');
        await browser.disconnect();
        console.log('👋 已断开连接');
        process.exit(0);
      } else if (text) {
        await sendMessage(page, text);
      }
    });

    // 监听断开连接
    browser.on('disconnected', () => {
      console.log('\n⚠️  浏览器连接已断开');
      clearInterval(chatCheckInterval);
      process.exit(0);
    });

    console.log('💬 开始监听聊天...\n');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error('\n💡 提示: 请确保已运行 start_browser.js 并登录游戏');
    process.exit(1);
  }
}

main();
