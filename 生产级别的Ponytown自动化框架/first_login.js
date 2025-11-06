#!/usr/bin/env node
/**
 * 🔑 Ponytown首次登录脚本（有头模式）
 *
 * 用途：第一次使用时，手动登录并保存session
 * 之后可以用headless模式自动登录
 */

const puppeteer = require('puppeteer');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'browser_data');

console.log('🦄 首次登录向导\n');
console.log('📁 用户数据将保存到:', USER_DATA_DIR);
console.log('');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,  // 必须是有头模式才能手动登录
      userDataDir: USER_DATA_DIR,  // 关键！保存登录状态
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    console.log('✅ 浏览器已启动！');
    console.log('');
    console.log('📝 请按照以下步骤操作：');
    console.log('  1. 在打开的浏览器中访问 https://pony.town/');
    console.log('  2. 使用GitHub账号登录');
    console.log('  3. 进入游戏');
    console.log('  4. 确认已成功进入游戏后，关闭此终端（Ctrl+C）');
    console.log('');
    console.log('⚠️  登录信息会被保存，之后可以使用无头模式！');
    console.log('');

    // 自动打开Ponytown
    const pages = await browser.pages();
    if (pages.length > 0) {
      try {
        await pages[0].goto('https://pony.town/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (err) {
        console.log('提示：请手动访问 pony.town');
      }
    }

    // 保持运行
    process.stdin.resume();

    process.on('SIGINT', async () => {
      console.log('\n\n💾 保存登录状态...');
      await browser.close();
      console.log('✅ 完成！现在可以使用 node headless_play.js 来无头运行了');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
})();
