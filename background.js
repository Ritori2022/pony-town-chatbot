// background.js — 清理控制窗口记录
chrome.windows.onRemoved.addListener(async (windowId) => {
  const data = await chrome.storage.session.get('controllerWindowId');
  if (data.controllerWindowId === windowId) {
    await chrome.storage.session.remove('controllerWindowId');
  }
});
