// content.js — 注入到 pony.town 页面
// 职责：
//   1) 监听聊天记录中新增的消息（MutationObserver）
//   2) 上报新消息到扩展（controller 窗口会收到）
//   3) 收到 SEND_MESSAGE 指令时，模拟打开输入框 → 写入 → 发送

(() => {
  if (window.__PT_GLM_LOADED__) return;
  window.__PT_GLM_LOADED__ = true;

  // ──────────────────────────────────────────────
  // PT 工具集（基于「交互资料.txt」中验证过的封装）
  // ──────────────────────────────────────────────
  const PT = {
    get ta()  { return document.querySelector('textarea[aria-label="Chat message"]'); },
    get log() { return document.querySelector('chat-log > .chat-log'); },

    isInputOpen() {
      const t = this.ta;
      return !!t && t.offsetParent !== null && t.getBoundingClientRect().width > 0;
    },
    isFocused() { return document.activeElement === this.ta; },
    isLogOpen() {
      const l = this.log;
      return !!l && getComputedStyle(l).display !== 'none';
    },

    openInput() {
      if (this.isInputOpen()) return;
      const btn = document.querySelector('.chat-open-button button');
      if (btn) { btn.click(); return; }
      // 兜底：派发 Enter
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
    },

    setText(text) {
      const ta = this.ta;
      if (!ta) return false;
      ta.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      ).set;
      setter.call(ta, text);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },

    clickSend() {
      const btn = document.querySelector('.chat-box-controls ui-button button');
      if (btn) { btn.click(); return true; }
      // 兜底：textarea 上派发 Enter
      const ta = this.ta;
      if (!ta) return false;
      ta.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
      return true;
    },

    /** 真正发送一条文字。会自动等待输入框就绪。 */
    async sendMessage(text) {
      const clean = String(text || '').slice(0, 400);
      if (!clean) return false;

      if (!this.isInputOpen()) this.openInput();

      // 等待 textarea 出现
      for (let i = 0; i < 30; i++) {
        if (this.ta) break;
        await new Promise(r => setTimeout(r, 50));
      }
      if (!this.ta) return false;

      // 再等一帧让 Angular 挂上事件
      await new Promise(r => requestAnimationFrame(r));

      this.setText(clean);
      // 给一点时间同步 model
      await new Promise(r => setTimeout(r, 60));
      this.clickSend();
      return true;
    },

    /** 解析单条 .chat-line DOM 节点 */
    parseLine(line) {
      if (!line || line.nodeType !== 1) return null;
      const time = line.querySelector('.chat-line-timestamp')?.textContent?.trim() || '';
      const label = line.querySelector('.chat-line-label')?.textContent?.trim() || '';
      let name  = line.querySelector('.chat-line-name')?.textContent?.trim() || '';
      // pony.town 把 name 渲染成 "[xxx]"，统一去掉两侧方括号便于匹配
      name = name.replace(/^\[+\s*/, '').replace(/\s*\]+$/, '');
      const cloned = line.cloneNode(true);
      cloned.querySelectorAll(
        '.chat-line-lead,.chat-line-timestamp,.chat-line-label,.chat-line-name'
      ).forEach(n => n.remove());
      const text = cloned.textContent.trim();
      const channel = Array.from(line.classList).find(
        c => /^chat-line-(party|local|personal|whisper|announcement|server|selected)/.test(c)
      ) || '';
      return { time, label, name, text, channel, raw: line.textContent.trim() };
    },
  };

  // ──────────────────────────────────────────────
  // MutationObserver: 监听新消息
  // ──────────────────────────────────────────────
  let observer = null;
  let retryTimer = null;
  let attachedRoot = null;     // 当前 observe 的节点引用
  // 用"内容指纹"做去重，而不是 DOM 节点引用：
  // pony.town 的 chat-log 在达到 100 行后会复用旧节点 (recycle)，
  // 老的 WeakSet<Node> 会把"换了文字的旧节点"误判成已见过的消息而漏报。
  // 改成 Set<string> 以 time|name|text|channel 为 key 就能跟着内容变化识别。
  let seenContentKeys = new Set();
  const MAX_SEEN_CONTENT_KEYS = 3000; // 超出后保留最新一半，防止无限增长
  let mutationCount = 0;
  let reportCount   = 0;
  let lastReportTs  = 0; // 最近一次成功上报的时间戳，诊断用

  function contentKey(msg) {
    return `${msg.time || ''}|${msg.name || ''}|${msg.text || ''}|${msg.channel || ''}`;
  }

  let msgCounter = 0;
  function reportNewMessage(line) {
    if (!line || line.nodeType !== 1) return;
    const msg = PT.parseLine(line);
    if (!msg || (!msg.text && !msg.raw)) return;
    const key = contentKey(msg);
    if (seenContentKeys.has(key)) return;
    seenContentKeys.add(key);
    if (seenContentKeys.size > MAX_SEEN_CONTENT_KEYS) {
      // 保留最新一半（Set 保留插入顺序）
      const arr = Array.from(seenContentKeys);
      seenContentKeys = new Set(arr.slice(Math.floor(arr.length / 2)));
    }
    reportCount++;
    lastReportTs = Date.now();
    msgCounter++;
    // 双通道：
    //   1) chrome.runtime.sendMessage —— 实时快通道，但 MV3 偶发会失败
    //   2) chrome.storage.local 写独立 key —— 可靠通道，controller 用 onChanged 接
    // controller 端基于 msgKey 去重，重复到达不会污染历史。
    chrome.runtime.sendMessage({ type: 'PT_NEW_CHAT', message: msg })
      .catch(() => {/* 走 storage 兜底就行 */});
    const storageKey = `pt_glm_msg__${Date.now()}_${msgCounter}`;
    chrome.storage.local.set({ [storageKey]: msg })
      .catch(err => console.warn('[PT GLM] storage 写入失败:', err?.message));
    if (reportCount % 20 === 0) {
      console.log(`[PT GLM] 已上报 ${reportCount} 条消息`);
    }
  }

  function scanForChatLines(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList?.contains('chat-line')) {
      reportNewMessage(node);
      return;
    }
    // 嵌套节点：往里搜索
    const inner = node.querySelectorAll?.('.chat-line');
    if (inner && inner.length) inner.forEach(reportNewMessage);
  }

  function attachObserver() {
    // 优先挂在自定义元素 <chat-log> 上 + subtree:true，
    // 这样无论内部如何重渲都能捕获 .chat-line 的添加
    const root = document.querySelector('chat-log') || PT.log;
    if (!root) {
      retryTimer = setTimeout(attachObserver, 1500);
      return;
    }
    if (observer && attachedRoot === root) return; // 已挂在同一节点
    if (observer) observer.disconnect();

    observer = new MutationObserver(muts => {
      mutationCount += muts.length;
      for (const m of muts) {
        m.addedNodes.forEach(scanForChatLines);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    attachedRoot = root;
    console.log('[PT GLM] ✅ 聊天监听已挂载到', root.tagName);
  }

  // ──────────────────────────────────────────────
  // 第二层 observer：挂在 document.body 上 (subtree:true)
  // body 永远不会被替换、observer 不受 tab 后台节流影响、
  // 即使 chat-log 元素整体被 Angular 替换，新出现的 .chat-line 仍会被捕获
  // ──────────────────────────────────────────────
  let bodyObserver = null;
  function attachBodyObserver() {
    if (bodyObserver) return;
    bodyObserver = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type !== 'childList') continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.classList?.contains('chat-line')) {
            reportNewMessage(n);
          } else if (n.querySelectorAll) {
            const inner = n.querySelectorAll('.chat-line');
            if (inner.length) inner.forEach(reportNewMessage);
          }
        }
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    console.log('[PT GLM] ✅ body-level observer 已挂载（覆盖 chat-log 整体替换场景）');
  }

  // 页面 DOM 可能晚于 content script 加载，做一个稳健启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachObserver();
      attachBodyObserver();
    }, { once: true });
  } else {
    attachObserver();
    if (document.body) attachBodyObserver();
    else document.addEventListener('DOMContentLoaded', attachBodyObserver, { once: true });
  }

  // 兜底 1：每 2s 检查 observer 是否还在原节点（pony.town 重连会替换 chat-log）
  setInterval(() => {
    const root = document.querySelector('chat-log') || PT.log;
    if (!root) return;
    if (!observer || !attachedRoot || !attachedRoot.isConnected || attachedRoot !== root) {
      console.log('[PT GLM] observer 失效或 root 已替换，重新挂载');
      attachObserver();
    }
  }, 2000);

  // 兜底 2：每 2s 主动扫描 .chat-line，补报 observer 漏掉的（最关键的保险丝）
  // 这样即使 MutationObserver 失效、DOM 被整体替换、service worker 短暂休眠，
  // 消息也不会丢；上报到 controller 端有 msgKey 去重，不会重复入历史。
  let scanCount = 0;
  let lastReportCountAtScan = 0;
  setInterval(() => {
    const log = PT.log;
    if (!log) return;
    const lines = log.querySelectorAll('.chat-line');
    if (!lines.length) return;
    const before = reportCount;
    for (const line of lines) {
      reportNewMessage(line); // 内部按内容指纹去重，重复调用无害
    }
    const recovered = reportCount - before;
    scanCount++;
    lastReportCountAtScan = reportCount;
    if (recovered > 0) {
      console.log(`[PT GLM] 兜底扫描补报 ${recovered} 条 (扫描总次数 ${scanCount})`);
    }
  }, 2000);

  // 暴露一个全局调试入口，便于在 Console 里检查状态
  window.__PT_GLM_DEBUG__ = () => ({
    observerAttached: !!observer,
    bodyObserverAttached: !!bodyObserver,
    attachedRoot,
    chatLog: PT.log,
    customElement: document.querySelector('chat-log'),
    mutationCount,
    reportCount,
    scanCount,
    seenContentKeysSize: seenContentKeys.size,
    currentLines: PT.log ? PT.log.querySelectorAll('.chat-line').length : 0,
    lastReportSecAgo: lastReportTs ? Math.round((Date.now() - lastReportTs) / 1000) : null,
  });

  // 暴露手动重挂入口，调试用
  window.__PT_GLM_REATTACH__ = () => {
    if (observer) observer.disconnect();
    observer = null;
    attachedRoot = null;
    attachObserver();
    return 'reattached';
  };

  // ──────────────────────────────────────────────
  // 接收 controller 的指令
  // ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'PT_PING') {
      sendResponse({ ok: true, hasLog: !!PT.log });
      return true;
    }
    if (msg?.type === 'PT_SEND_MESSAGE') {
      PT.sendMessage(msg.text).then(ok => sendResponse({ ok }));
      return true;
    }
    if (msg?.type === 'PT_READ_HISTORY') {
      const log = PT.log;
      const all = log
        ? Array.from(log.querySelectorAll('.chat-line')).map(l => PT.parseLine(l)).filter(Boolean)
        : [];
      sendResponse({ ok: true, messages: all });
      return true;
    }
    if (msg?.type === 'PT_DEBUG_STATE') {
      // 给 controller 端诊断按钮用 —— 返回 content script 端的完整状态
      const log = PT.log;
      sendResponse({
        ok: true,
        observerAttached: !!observer,
        bodyObserverAttached: !!bodyObserver,
        attachedRootConnected: !!(attachedRoot && attachedRoot.isConnected),
        attachedRootTag: attachedRoot?.tagName || null,
        currentChatLogPresent: !!log,
        currentLineCount: log ? log.querySelectorAll('.chat-line').length : 0,
        mutationCount,
        reportCount,
        scanCount,
        seenContentKeysSize: seenContentKeys.size,
        lastReportTs,
        sinceLastReportSec: lastReportTs ? Math.round((Date.now() - lastReportTs) / 1000) : null,
        pageVisibility: document.visibilityState,
        pageUrl: location.href,
      });
      return true;
    }
  });

  console.log('[PT GLM] content script 已加载 v2');
})();
