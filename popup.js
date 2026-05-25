// popup.js — 只负责打开/聚焦控制窗口

const CONTROLLER_URL = chrome.runtime.getURL('controller.html');

document.getElementById('openBtn').addEventListener('click', async () => {
  // 检查是否已有控制窗口
  const data = await chrome.storage.session.get('controllerWindowId');
  if (data.controllerWindowId) {
    try {
      await chrome.windows.update(data.controllerWindowId, { focused: true });
      window.close();
      return;
    } catch {
      // 窗口已关闭，重新创建
    }
  }

  const win = await chrome.windows.create({
    url: CONTROLLER_URL,
    type: 'popup',
    width: 380,
    height: 720,
    focused: true,
  });

  await chrome.storage.session.set({ controllerWindowId: win.id });
  window.close();
});
