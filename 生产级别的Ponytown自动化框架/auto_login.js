#!/usr/bin/env node
/**
 * 🔐 Ponytown完全自动登录脚本
 *
 * 实现完整的无头自动登录流程：
 * 1. 访问 pony.town
 * 2. 点击GitHub登录
 * 3. 自动填写GitHub账号密码
 * 4. 处理授权
 * 5. 进入游戏
 */

const puppeteer = require('puppeteer');
const path = require('path');

// 配置
const CONFIG = {
  PONYTOWN_URL: 'https://pony.town/',
  GITHUB_EMAIL: process.env.GITHUB_EMAIL || 'arrowmancer@163.com',
  GITHUB_PASSWORD: process.env.GITHUB_PASSWORD || 'Biqvew-menge7-guzxyk',
  HEADLESS: true,  // 无头模式
  TIMEOUT: 30000,
  CHROMIUM_PATH: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
};

console.log('🦄 Ponytown自动登录脚本启动中...\n');

async function autoLogin() {
  let browser;

  try {
    // 启动浏览器
    console.log('🚀 启动浏览器（无头模式）...');
    browser = await puppeteer.launch({
      headless: CONFIG.HEADLESS,
      executablePath: CONFIG.CHROMIUM_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,720',
        '--ignore-certificate-errors',
        // 更多反检测参数
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials'
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    // 设置真实的User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 反检测措施
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      window.chrome = {
        runtime: {},
      };
    });

    console.log('✅ 浏览器已启动');

    // 步骤1：访问Ponytown
    console.log('\n🌐 访问 Ponytown...');
    await page.goto(CONFIG.PONYTOWN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUT
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 检查是否被拦截
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('页面内容（前200字符）:', bodyText.substring(0, 200));

    if (bodyText.includes('Access denied')) {
      console.error('\n❌ 被反自动化检测拦截！');
      console.log('💡 建议：');
      console.log('  1. 使用有头模式进行首次登录');
      console.log('  2. 或使用 userDataDir 保存session');
      await browser.close();
      return false;
    }

    // 步骤2：查找并点击登录按钮
    console.log('\n🔍 查找登录入口...');

    // 尝试多种选择器
    const loginSelectors = [
      'button:has-text("Sign in")',
      'button:has-text("Play")',
      'button:has-text("Login")',
      'text=Sign in',
      'text=Play'
    ];

    let loginClicked = false;
    for (const selector of loginSelectors) {
      try {
        const clicked = await page.evaluate((sel) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const text = btn.innerText.toLowerCase();
            if (text.includes('sign') || text.includes('play') || text.includes('login')) {
              btn.click();
              return true;
            }
          }
          return false;
        }, selector);

        if (clicked) {
          console.log('✅ 点击了登录按钮');
          loginClicked = true;
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!loginClicked) {
      console.log('⚠️  未找到登录按钮，尝试查找页面元素...');
      const allButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(btn => btn.innerText);
      });
      console.log('页面上的按钮:', allButtons);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 步骤3：查找GitHub登录选项
    console.log('\n🐙 查找GitHub登录...');

    const githubClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('button, a, div'));
      for (const el of allElements) {
        const text = (el.innerText || '').toLowerCase();
        if (text.includes('github')) {
          console.log('找到GitHub元素:', el.innerText);
          el.click();
          return true;
        }
      }
      return false;
    });

    if (!githubClicked) {
      console.log('❌ 未找到GitHub登录选项');
      await browser.close();
      return false;
    }

    console.log('✅ 点击了GitHub登录');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 步骤4：检查是否跳转到GitHub
    const currentUrl = page.url();
    console.log('\n📍 当前URL:', currentUrl);

    if (!currentUrl.includes('github.com')) {
      console.log('❌ 未跳转到GitHub登录页面');
      console.log('页面内容:', await page.evaluate(() => document.body.innerText.substring(0, 300)));
      await browser.close();
      return false;
    }

    console.log('✅ 已跳转到GitHub授权页面');

    // 步骤5：填写GitHub登录信息
    console.log('\n🔑 填写GitHub登录信息...');

    try {
      // 等待登录表单
      await page.waitForSelector('input[name="login"], input[type="text"]', { timeout: 5000 });

      console.log('  📧 输入邮箱...');
      await page.type('input[name="login"], input[type="text"]', CONFIG.GITHUB_EMAIL, { delay: 100 });

      console.log('  🔒 输入密码...');
      await page.type('input[name="password"], input[type="password"]', CONFIG.GITHUB_PASSWORD, { delay: 100 });

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('  🚀 提交登录表单...');
      await page.click('input[type="submit"], button[type="submit"]');

      console.log('✅ 已提交GitHub登录');

    } catch (error) {
      console.error('❌ 填写GitHub表单失败:', error.message);

      // 截图调试
      try {
        await page.screenshot({ path: 'github_login_error.png' });
        console.log('📸 已保存错误截图: github_login_error.png');
      } catch (e) {}

      await browser.close();
      return false;
    }

    // 步骤6：等待处理（可能有2FA/邮箱验证）
    console.log('\n⏳ 等待GitHub处理...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterLoginUrl = page.url();
    console.log('📍 登录后URL:', afterLoginUrl);

    // 检查是否需要邮箱验证
    const pageContent = await page.evaluate(() => document.body.innerText);

    if (pageContent.toLowerCase().includes('verify') ||
        pageContent.toLowerCase().includes('email') ||
        pageContent.toLowerCase().includes('code')) {

      console.log('\n⚠️  检测到需要邮箱验证！');
      console.log('📧 请检查邮箱 ' + CONFIG.GITHUB_EMAIL);
      console.log('   并手动完成验证，或在代码中添加邮箱验证逻辑');

      // 保持浏览器打开，等待手动验证
      if (!CONFIG.HEADLESS) {
        console.log('\n⏰ 浏览器将保持打开60秒供手动验证...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    // 步骤7：检查是否成功授权并返回Ponytown
    await new Promise(resolve => setTimeout(resolve, 3000));
    const finalUrl = page.url();
    console.log('\n📍 最终URL:', finalUrl);

    if (finalUrl.includes('pony.town')) {
      console.log('✅ 成功返回Ponytown！');

      // 等待游戏加载
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 检查是否进入游戏
      const inGame = await page.evaluate(() => {
        return !!document.querySelector('chat-box') && !!document.querySelector('canvas');
      });

      if (inGame) {
        console.log('🎮 成功进入游戏！\n');
        console.log('✨ 自动登录完成！');

        // 发送测试消息
        try {
          await page.evaluate(() => {
            const chatBox = document.querySelector('chat-box .chat-open-button');
            if (chatBox) chatBox.click();
          });
          await new Promise(resolve => setTimeout(resolve, 500));
          await page.type('chat-box .chat-box .chat-textarea', 'Luna自动登录成功！喵～');
          await page.evaluate(() => {
            const sendBtn = document.querySelector('chat-box .chat-box ui-button > button');
            if (sendBtn) sendBtn.click();
          });
          console.log('💬 已发送测试消息');
        } catch (e) {
          console.log('⚠️  发送消息失败（可能聊天框未打开）');
        }

        // 保持运行
        console.log('\n⏰ 浏览器将保持打开30秒...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        await browser.close();
        return true;

      } else {
        console.log('⚠️  已返回Ponytown但未检测到游戏界面');
        console.log('可能需要额外的交互步骤');
      }
    } else {
      console.log('❌ 未能返回Ponytown');
      console.log('可能卡在GitHub授权页面');
    }

    await browser.close();
    return false;

  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    console.error(error.stack);
    if (browser) await browser.close();
    return false;
  }
}

// 运行
autoLogin().then(success => {
  if (success) {
    console.log('\n🎉 登录成功！');
    process.exit(0);
  } else {
    console.log('\n❌ 登录失败');
    console.log('💡 提示：');
    console.log('  1. 检查账号密码是否正确');
    console.log('  2. 尝试有头模式查看具体问题：修改 HEADLESS: false');
    console.log('  3. 查看是否需要邮箱验证');
    process.exit(1);
  }
});
