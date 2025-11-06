/**
 * 🛠️ Ponytown工具函数库
 *
 * 提供与Ponytown游戏交互的通用函数
 */

/**
 * 获取WebSocket调试端点
 * @param {number} port - 远程调试端口
 * @returns {Promise<string>} WebSocket URL
 */
async function getWSEndpoint(port = 9222) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const data = await res.json();
      return data.webSocketDebuggerUrl;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`获取WebSocket端点失败，端口: ${port}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * 获取聊天记录
 * @param {Page} page - Puppeteer页面对象
 * @returns {Promise<Array>} 聊天消息数组
 */
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
            timestamp: match[1],
            player: match[2],
            message: match[3]
          };
        }
        return null;
      }).filter(msg => msg !== null);
    });

    return messages;
  } catch (error) {
    console.error('获取聊天记录失败:', error);
    return [];
  }
}

/**
 * 发送聊天消息
 * @param {Page} page - Puppeteer页面对象
 * @param {string} message - 要发送的消息
 * @returns {Promise<boolean>} 是否成功
 */
async function sendMessage(page, message) {
  try {
    // 检查聊天框是否打开
    const isChatBoxOpen = await page.evaluate(() => {
      const chatBox = document.querySelector('chat-box .chat-box');
      return chatBox && chatBox.offsetParent !== null;
    });

    // 打开聊天框
    if (!isChatBoxOpen) {
      await page.click('chat-box .chat-open-button');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 输入并发送消息
    await page.type('chat-box .chat-box .chat-textarea', message);
    await page.evaluate(() => {
      const sendButton = document.querySelector('chat-box .chat-box ui-button > button');
      if (sendButton) sendButton.click();
    });

    return true;
  } catch (error) {
    console.error('发送消息失败:', error);
    return false;
  }
}

/**
 * 移动角色
 * @param {Page} page - Puppeteer页面对象
 * @param {string} direction - 方向 ('w', 'a', 's', 'd', 'up', 'down', 'left', 'right')
 * @param {number} duration - 持续时间（毫秒）
 */
async function moveCharacter(page, direction, duration = 1000) {
  const keyMap = {
    'up': 'w',
    'down': 's',
    'left': 'a',
    'right': 'd',
    'w': 'w',
    'a': 'a',
    's': 's',
    'd': 'd'
  };

  const key = keyMap[direction.toLowerCase()];
  if (!key) {
    throw new Error(`无效的方向: ${direction}`);
  }

  await page.keyboard.down(key);
  await new Promise(resolve => setTimeout(resolve, duration));
  await page.keyboard.up(key);
}

/**
 * 检查是否在游戏中
 * @param {Page} page - Puppeteer页面对象
 * @returns {Promise<boolean>}
 */
async function isInGame(page) {
  try {
    return await page.evaluate(() => {
      return !!document.querySelector('chat-box') &&
             !!document.querySelector('canvas');
    });
  } catch {
    return false;
  }
}

/**
 * 截图
 * @param {Page} page - Puppeteer页面对象
 * @param {string} path - 保存路径
 */
async function takeScreenshot(page, path = 'ponytown_screenshot.png') {
  try {
    await page.screenshot({ path, fullPage: false });
    console.log(`📸 截图已保存: ${path}`);
    return true;
  } catch (error) {
    console.error('截图失败:', error);
    return false;
  }
}

/**
 * 获取在线玩家列表（如果可见）
 * @param {Page} page - Puppeteer页面对象
 * @returns {Promise<Array<string>>}
 */
async function getOnlinePlayers(page) {
  try {
    return await page.evaluate(() => {
      // 这个选择器可能需要根据实际游戏界面调整
      const playerElements = document.querySelectorAll('.player-list .player-name');
      return Array.from(playerElements).map(el => el.innerText);
    });
  } catch {
    return [];
  }
}

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出函数
module.exports = {
  getWSEndpoint,
  getChatMessages,
  sendMessage,
  moveCharacter,
  isInGame,
  takeScreenshot,
  getOnlinePlayers,
  sleep
};
