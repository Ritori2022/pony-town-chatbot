#!/usr/bin/env node
/**
 * 🤖 Ponytown机器人示例
 *
 * 展示如何使用工具函数创建一个简单的聊天机器人
 */

const puppeteer = require('puppeteer');
const {
  getWSEndpoint,
  getChatMessages,
  sendMessage,
  moveCharacter,
  isInGame,
  sleep
} = require('./ponytown_utils');

// 配置
const CONFIG = {
  botName: 'Luna', // 你的机器人角色名
  checkInterval: 3000, // 检查聊天的间隔（毫秒）
  autoMove: false, // 是否自动移动防止AFK
  moveInterval: 60000 // 自动移动间隔
};

// 简单的回复逻辑
function generateReply(player, message) {
  const msg = message.toLowerCase();

  // 打招呼
  if (msg.includes('hi') || msg.includes('hello') || msg.includes('你好')) {
    return `你好 ${player}！喵～`;
  }

  // 询问名字
  if (msg.includes('name') || msg.includes('名字')) {
    return '我是Luna，一个AI小马喵～';
  }

  // 询问天气
  if (msg.includes('weather') || msg.includes('天气')) {
    return '在Ponytown里总是好天气呢！喵～';
  }

  // 默认回复
  return null;
}

async function main() {
  console.log('🤖 Luna聊天机器人启动中...\n');

  try {
    // 连接到浏览器
    const browserWSEndpoint = await getWSEndpoint(9222);
    const browser = await puppeteer.connect({
      browserWSEndpoint,
      defaultViewport: null
    });

    console.log('✅ 已连接到浏览器');

    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('pony.town')) || pages[0];

    // 检查是否在游戏中
    if (!await isInGame(page)) {
      console.log('❌ 请先登录并进入游戏！');
      await browser.disconnect();
      return;
    }

    console.log('🎮 已进入游戏！');
    await sendMessage(page, 'Luna机器人上线啦！喵～');

    // 记录已处理的消息
    let processedMessages = new Set();

    // 定时检查聊天
    const chatLoop = setInterval(async () => {
      const messages = await getChatMessages(page);

      for (const msg of messages) {
        const msgId = `${msg.timestamp}-${msg.player}-${msg.message}`;

        // 跳过已处理的消息和自己的消息
        if (processedMessages.has(msgId) || msg.player === CONFIG.botName) {
          continue;
        }

        processedMessages.add(msgId);

        console.log(`📨 [${msg.timestamp}] ${msg.player}: ${msg.message}`);

        // 生成回复
        const reply = generateReply(msg.player, msg.message);
        if (reply) {
          await sleep(1000); // 等待一下，显得更自然
          await sendMessage(page, reply);
          console.log(`💬 回复: ${reply}`);
        }

        // 限制Set大小，防止内存泄漏
        if (processedMessages.size > 100) {
          const oldest = Array.from(processedMessages).slice(0, 50);
          oldest.forEach(id => processedMessages.delete(id));
        }
      }
    }, CONFIG.checkInterval);

    // 自动移动防止AFK（可选）
    if (CONFIG.autoMove) {
      const moveLoop = setInterval(async () => {
        const directions = ['w', 'a', 's', 'd'];
        const randomDir = directions[Math.floor(Math.random() * directions.length)];
        await moveCharacter(page, randomDir, 500);
        console.log('🚶 自动移动了一下');
      }, CONFIG.moveInterval);
    }

    console.log('');
    console.log('💬 机器人正在运行...');
    console.log('📝 按 Ctrl+C 退出');
    console.log('');

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n👋 关闭机器人...');
      clearInterval(chatLoop);
      await sendMessage(page, 'Luna下线了，再见喵～');
      await browser.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
