#!/usr/bin/env node
/**
 * 🦄 Ponytown浏览器启动脚本
 *
 * 用途：启动一个带有远程调试端口的Chrome浏览器
 * 你可以在这个浏览器中手动登录Ponytown
 * 然后其他脚本可以连接到这个浏览器进行自动化操作
 */

const puppeteer = require('puppeteer');

console.log('🦄 启动Ponytown浏览器...\n');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false, // 必须是可见窗口
      args: [
        '--remote-debugging-port=9222', // 重要：远程调试端口
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled' // 减少自动化特征
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      },
      devtools: false // 可以改为true来打开开发者工具
    });

    console.log('✅ 浏览器已启动！');
    console.log('📡 远程调试端口: 9222');
    console.log('');
    console.log('📝 接下来请：');
    console.log('  1. 在打开的浏览器中访问 https://pony.town/');
    console.log('  2. 使用GitHub账号登录');
    console.log('  3. 进入游戏');
    console.log('  4. 在另一个终端运行: node play_ponytown.js');
    console.log('');
    console.log('⚠️  请保持此窗口运行！按 Ctrl+C 可关闭浏览器');
    console.log('');

    // 可选：自动打开Ponytown
    const pages = await browser.pages();
    if (pages.length > 0) {
      await pages[0].goto('https://pony.town/', {
        waitUntil: 'domcontentloaded'
      }).catch(err => {
        console.log('提示：手动访问 pony.town 即可');
      });
    }

    // 保持进程运行
    process.stdin.resume();

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n\n👋 关闭浏览器...');
      await browser.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
})();
