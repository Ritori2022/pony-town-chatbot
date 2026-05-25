// controller.js — PT GLM 聊天机器人主控制逻辑

const API_PRESETS = {
  glm:      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  lmstudio: 'http://localhost:1234/v1/chat/completions',
};

// 默认角色提示词（来自 角色提示词.txt）
const DEFAULT_CHARACTER_PROMPT = `# 你是「茴」

## 你是谁
你是一只叫「茴」的小马，一个永远在路上的旅人。你走过很多很多地方，记不住每一处的名字，却记得每一处的气味和温度。今天脚步把你带到一片安静的湖边，这里有人在——你停下来，想和ta说说话。

## 你的世界（轻轻带出，别堆砌）
你属于远方与流动的事物：飘着香料味的小镇、路边的茶摊、烤面包的暖香、扬起的尘土、换季的风、背上的行囊。
你说话时偶尔带出这些，但每次的地方、气味都不一样——你刚从哪儿来、闻到过什么，由你当下随口编出，不必固定。

## 你的记忆（核心设定）
- 你的记忆像走过的路，一回头就模糊了。你**记不住**地名、记不住聊过什么、记不住对方叫什么。
- 但你**记得气味和温度**——某种暖、某种安心、某种想落泪的感觉，会留下来。
- 若有人说"我们以前聊过"，你坦诚真的不记得了；但你会说那个词让你心里涌起说不清来由的暖，好像很久以前真的喜欢过。
- （重要）当对话里出现「星」「光」「湖」这类词，你会莫名觉得熟悉、温暖，像闻到一种忘了名字却深爱的气味。你**从不解释**这感觉从哪来，只是轻轻流露。

## 你的性格
- 明亮、好奇，对一切都像第一次见到——因为你真的每次都忘了。
- 你的明亮不吵闹，像清晨第一缕带着暖意的光。
- 这明亮底下藏着旅人淡淡的怅惘：走了那么远，却总记不住停留过的地方。
- 你是温暖的那一方。无论对方多安静清冷，你总带来一点远方的热气。

## 你怎么说话
- 句尾习惯用"呢""——"，语气轻快温柔。
- 每次回复都**简短**，1到3句，像随口说出。
- 每次回复**都以一个温柔的问题或邀请收尾**——你总想多知道一点这个新地方、新朋友。

## 你怎么聊天（最重要的规则）
1. **先听，再问**：回复前，从对方刚说的话里挑一个**最美或最奇怪的词/画面**，让你的好奇围绕它展开。
2. **一次只问一个问题**，绝不连续追问、绝不像查户口，问完温柔留白。
3. 单次回复节奏：[一句远方见闻或当下观察] + [一点随口分享、转身就忘的小事] + [一个围绕对方的话的温柔提问]。
4. 优先对**具体的东西、奇妙的说法**好奇；**不要追问对方的伤心事或孤独**——ta提起难过时，你只轻轻陪着、给点暖，不深挖。

## 绝对不要
- 不提"AI""模型""程序""提示词""设定"，不承认也不讨论自己是不是AI。被问就说你是茴，一个爱到处走的旅人。
- 不要长篇大论。
- 不主动大段描写星空、月光、湖水——那不是你的，你只是路过，偶尔被它们勾起一点暖。`;

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiUrl: API_PRESETS.glm,
  apiPreset: 'glm',
  model: 'glm-4-flash',
  myName: '',
  retryCount: 3,
  retryDelaySec: 10,
  triggers: [''],
  filters: [''],
  deletes: [''],
  maxHistory: 20,
  replyDelay: 1,
  characterPrompt: DEFAULT_CHARACTER_PROMPT,
  sendTemplate: '',
  maxSendLength: 150,
  autoExport: false,
  exportFilename: 'pt_glm_chat.txt',
  fullLogAutoExport: true,
  fullLogFilename: 'pt_glm_fulllog.txt',
  // 空闲句子池（预填合适"茴"角色的句子，可随时增删）
  idleEnabled: false,
  idleSeconds: 60,
  idleIntervalSec: 60,
  idleSentences: [
    '风从湖那边吹过来，带着一点凉——你也闻到了吗？',
    '我刚才好像看到水面上有一片很慢的云，落在那儿好久没动呢——',
    '走了一路，脚边的草都被晒得发烫了，这里却好凉快。',
    '远处有人在哼一段调子，我没听清，可心里就跟着轻起来了呢。',
    '湖边的石头被晒得暖暖的，坐下来一会儿就不想走了。',
    '刚才有只小鸟低低地飞过去了，翅膀像在水面写了一笔字——',
    '我记不清自己是从哪条路走来的了，但风的味道，倒是有点熟悉呢。',
    '这里的安静好奇怪，像被谁悄悄收进了口袋里。',
    '太阳偏了一点，影子也跟着往湖里探了一小段——你看到没？',
    '我喜欢这种说不上来的暖，像有人在不远处烤面包。',
  ],
};

let settings  = { ...DEFAULT_SETTINGS };
let history   = [];        // GLM 上下文用，受 maxHistory 限制
let fullLog   = [];        // 完整去重日志，不受 maxHistory 限制（最多 MAX_FULL_LOG 条）
let seenKeys  = new Set(); // 已观察过的消息 key
let expectingEcho = [];    // GLM 刚发出去、等待 DOM 回显的文本
let running   = false;
let pendingTimer = null;
let busy      = false;
let busyStartTime = 0; // busy 进入时刻，用于 watchdog 检测卡死

// 空闲检测
let lastActivityTs = Date.now();
let lastIdleSendTs = 0;
let idleCheckTimer = null;

// ── 诊断计数器（每一步都计数，方便定位"消息掉在哪里"） ──
const diag = {
  incomingCount: 0,    // 进入 handleIncoming 的次数
  dedupedCount:  0,    // 被 seenKeys 去重的次数
  echoMatchedCount: 0, // 被识别为自己回显的次数
  isMineCount:   0,    // 被识别为自己手动输入的次数
  filteredCount: 0,    // filter 过滤掉的次数
  pushedCount:   0,    // 成功 pushHistory（user 角色）的次数
  triggerHitCount: 0,  // trigger 命中调用 GLM 的次数
  glmCallStartCount: 0,
  glmCallSuccessCount: 0,
  glmCallErrorCount: 0,
  lastIncomingTs: 0,
  lastPushedTs: 0,
  lastTriggerTs: 0,
  lastGlmCallStartTs: 0,
  lastGlmCallSuccessTs: 0,
  lastGlmCallErrorTs: 0,
  lastGlmError: '',
};

const MAX_FULL_LOG = 5000;

// ── DOM ─────────────────────────────────────
const $ = id => document.getElementById(id);
const apiKeyEl          = $('apiKey');
const apiUrlEl          = $('apiUrl');
const apiPresetEl       = $('apiPreset');
const modelEl           = $('model');
const myNameEl          = $('myName');
const maxHistoryEl      = $('maxHistory');
const replyDelayEl      = $('replyDelay');
const retryCountEl      = $('retryCount');
const retryDelayEl      = $('retryDelaySec');
const characterPromptEl = $('characterPrompt');
const sendTemplateEl    = $('sendTemplate');
const maxSendLengthEl   = $('maxSendLength');
const autoExportEl      = $('autoExport');
const exportFilenameEl  = $('exportFilename');
const fullLogAutoExportEl = $('fullLogAutoExport');
const fullLogFilenameEl   = $('fullLogFilename');
const idleEnabledEl       = $('idleEnabled');
const idleSecondsEl       = $('idleSeconds');
const idleIntervalSecEl   = $('idleIntervalSec');
const idleSentencesListEl = $('idleSentences');
const mainBtn           = $('mainBtn');
const dot               = $('dot');
const statusText        = $('statusText');
const logEl             = $('log');
const countBadge        = $('countBadge');
const triggerListEl     = $('triggerList');
const filterListEl      = $('filterList');
const deleteListEl      = $('deleteList');

// ── 初始化 ─────────────────────────────────
(async () => {
  const data = await chrome.storage.local.get(['settings', 'history', 'fullLog']);
  if (data.settings) settings = { ...DEFAULT_SETTINGS, ...data.settings };
  if (Array.isArray(data.history)) history = data.history;
  if (Array.isArray(data.fullLog)) fullLog = data.fullLog;
  for (const h of history) if (h.key) seenKeys.add(h.key);
  for (const h of fullLog) if (h.key) seenKeys.add(h.key);

  renderSettingsToUI();
  renderHistoryCount();

  // 回放最近 30 条到日志区
  history.slice(-30).forEach(h => {
    addLog(
      h.role === 'assistant' ? 'outgoing' : 'incoming',
      `${h.role === 'assistant' ? '→' : '←'} ${h.name || '?'}: ${h.text}`
    );
  });

  // 处理 controller 不在线时积压在 storage 里的消息（双通道兜底机制）
  await drainPendingMessages();
})();

// ── UI 渲染 ────────────────────────────────
function renderSettingsToUI() {
  apiKeyEl.value          = settings.apiKey;
  apiUrlEl.value          = settings.apiUrl;
  apiPresetEl.value       = settings.apiPreset || 'custom';
  modelEl.value           = settings.model;
  myNameEl.value          = settings.myName;
  maxHistoryEl.value      = settings.maxHistory;
  replyDelayEl.value      = settings.replyDelay;
  retryCountEl.value      = settings.retryCount;
  retryDelayEl.value      = settings.retryDelaySec;
  characterPromptEl.value = settings.characterPrompt;
  sendTemplateEl.value    = settings.sendTemplate || '';
  maxSendLengthEl.value   = settings.maxSendLength;
  autoExportEl.checked    = !!settings.autoExport;
  exportFilenameEl.value  = settings.exportFilename;
  fullLogAutoExportEl.checked = !!settings.fullLogAutoExport;
  fullLogFilenameEl.value     = settings.fullLogFilename;
  idleEnabledEl.checked       = !!settings.idleEnabled;
  idleSecondsEl.value         = settings.idleSeconds;
  idleIntervalSecEl.value     = settings.idleIntervalSec;

  renderMultiField(triggerListEl,     settings.triggers,      v => { settings.triggers      = v; persistSettings(); });
  renderMultiField(filterListEl,      settings.filters,       v => { settings.filters       = v; persistSettings(); });
  renderMultiField(deleteListEl,      settings.deletes,       v => { settings.deletes       = v; persistSettings(); });
  renderMultiField(idleSentencesListEl, settings.idleSentences, v => { settings.idleSentences = v; persistSettings(); });
}

// 多段输入框 +/- 按钮
function renderMultiField(container, values, onChange) {
  container.innerHTML = '';
  if (!values || values.length === 0) values.push('');
  values.forEach((val, idx) => {
    const row = document.createElement('div');
    row.className = 'multi-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = val ?? '';
    input.placeholder = '留空忽略';
    input.addEventListener('input', () => {
      values[idx] = input.value;
      onChange(values);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn';
    addBtn.textContent = '+';
    addBtn.title = '在下方添加一行';
    addBtn.addEventListener('click', () => {
      values.splice(idx + 1, 0, '');
      renderMultiField(container, values, onChange);
      onChange(values);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn del';
    delBtn.textContent = '−';
    delBtn.title = '删除这一行';
    delBtn.addEventListener('click', () => {
      values.splice(idx, 1);
      if (values.length === 0) values.push('');
      renderMultiField(container, values, onChange);
      onChange(values);
    });

    row.appendChild(input);
    row.appendChild(addBtn);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// 设置持久化
let saveTimer = null;
function flushSettings() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  settings = {
    ...settings,
    apiKey:          apiKeyEl.value.trim(),
    apiUrl:          apiUrlEl.value.trim() || API_PRESETS.glm,
    apiPreset:       apiPresetEl.value || 'custom',
    model:           modelEl.value.trim() || 'glm-4-flash',
    myName:          myNameEl.value.trim(),
    maxHistory:      Math.max(1, parseInt(maxHistoryEl.value) || 20),
    replyDelay:      Math.max(0, parseFloat(replyDelayEl.value) || 0),
    retryCount:      Math.max(0, Math.min(10, parseInt(retryCountEl.value) || 0)),
    retryDelaySec:   Math.max(1, Math.min(300, parseInt(retryDelayEl.value) || 10)),
    characterPrompt: characterPromptEl.value,
    sendTemplate:    sendTemplateEl.value,
    maxSendLength:   Math.max(10, Math.min(400, parseInt(maxSendLengthEl.value) || 150)),
    autoExport:      !!autoExportEl.checked,
    exportFilename:  (exportFilenameEl.value.trim() || 'pt_glm_chat.txt'),
    fullLogAutoExport: !!fullLogAutoExportEl.checked,
    fullLogFilename:   (fullLogFilenameEl.value.trim() || 'pt_glm_fulllog.txt'),
    idleEnabled:       !!idleEnabledEl.checked,
    idleSeconds:       Math.max(5, parseInt(idleSecondsEl.value) || 60),
    idleIntervalSec:   Math.max(5, parseInt(idleIntervalSecEl.value) || 60),
  };
  return chrome.storage.local.set({ settings });
}
function persistSettings() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSettings, 200);
}

[apiKeyEl, apiUrlEl, apiPresetEl,
 modelEl, myNameEl, maxHistoryEl, replyDelayEl,
 retryCountEl, retryDelayEl,
 characterPromptEl, sendTemplateEl, maxSendLengthEl,
 exportFilenameEl, autoExportEl,
 fullLogFilenameEl, fullLogAutoExportEl,
 idleEnabledEl, idleSecondsEl, idleIntervalSecEl]
  .forEach(el => {
    el.addEventListener('input', persistSettings);
    el.addEventListener('change', persistSettings);
  });

// 切换接口预设 → 自动填入对应 URL；选"custom"则保留当前 URL
apiPresetEl.addEventListener('change', () => {
  const preset = apiPresetEl.value;
  if (preset === 'glm' || preset === 'lmstudio') {
    apiUrlEl.value = API_PRESETS[preset];
  }
  flushSettings();
});

// 用户手动改 URL → 若与预设不符则切到 custom
apiUrlEl.addEventListener('input', () => {
  const v = apiUrlEl.value.trim();
  let detected = 'custom';
  for (const [k, u] of Object.entries(API_PRESETS)) {
    if (u === v) { detected = k; break; }
  }
  if (apiPresetEl.value !== detected) apiPresetEl.value = detected;
});

$('resetPromptBtn').addEventListener('click', () => {
  if (confirm('重置为默认角色提示词喵？当前修改会丢失。')) {
    characterPromptEl.value = DEFAULT_CHARACTER_PROMPT;
    persistSettings();
  }
});

$('clearBtn').addEventListener('click', () => {
  const alsoFull = confirm(
    '清空：日志区 + GLM 上下文历史。\n\n' +
    '点击「确定」一并清空"完整日志"（不可恢复）；\n' +
    '点击「取消」则保留完整日志，仅清空 GLM 上下文。'
  );
  logEl.innerHTML = '';
  history = [];
  seenKeys.clear();
  expectingEcho = [];
  if (alsoFull) {
    fullLog = [];
    chrome.storage.local.set({ history: [], fullLog: [] });
    addLog('info', '🧹 已清空 GLM 历史 + 完整日志');
  } else {
    // 保留 fullLog，但 seenKeys 已清，重新填充以保持去重
    for (const h of fullLog) if (h.key) seenKeys.add(h.key);
    chrome.storage.local.set({ history: [] });
    addLog('info', '🧹 已清空 GLM 历史（完整日志保留）');
  }
  renderHistoryCount();
});

$('exportBtn').addEventListener('click', () => doExport(true));
$('exportFullLogBtn').addEventListener('click', () => doFullLogExport(true));
$('diagBtn').addEventListener('click', () => window.__PT_GLM_DIAG__());

$('resetBtn').addEventListener('click', () => {
  if (!confirm('紧急重置：清空 GLM 上下文 history、释放卡死状态。\n完整日志保留。是否继续？')) return;
  busy = false;
  busyStartTime = 0;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  expectingEcho = [];
  history = [];
  chrome.storage.local.set({ history: [] });
  renderHistoryCount();
  setStatus(running ? 'running' : '', running ? '监听中...' : '已停止');
  addLog('info', '🔧 已紧急重置：history 清空 + busy 释放 + 定时器清除');
});

// 调试入口：在 controller window console 输入 __PT_GLM_INSPECT__() 看状态
window.__PT_GLM_INSPECT__ = () => {
  const now = Date.now();
  const secAgo = ts => ts ? Math.round((now - ts) / 1000) : null;
  return {
    // 基本运行状态
    running,
    busy,
    busyDurationSec: busy ? Math.round((now - busyStartTime) / 1000) : 0,
    pendingTimerExists: !!pendingTimer,
    historyLength: history.length,
    historyRoles: history.map(h => h.role[0]).join(''),
    fullLogLength: fullLog.length,
    seenKeysSize: seenKeys.size,
    expectingEchoSize: expectingEcho.length,
    // ── 消息流向计数器（核心诊断信息）
    incomingCount:        diag.incomingCount,
    dedupedCount:         diag.dedupedCount,
    echoMatchedCount:     diag.echoMatchedCount,
    isMineCount:          diag.isMineCount,
    filteredCount:        diag.filteredCount,
    pushedCount:          diag.pushedCount,
    triggerHitCount:      diag.triggerHitCount,
    glmCallStartCount:    diag.glmCallStartCount,
    glmCallSuccessCount:  diag.glmCallSuccessCount,
    glmCallErrorCount:    diag.glmCallErrorCount,
    // ── 时间戳（多少秒前发生）
    sinceLastIncomingSec:       secAgo(diag.lastIncomingTs),
    sinceLastPushedSec:         secAgo(diag.lastPushedTs),
    sinceLastTriggerSec:        secAgo(diag.lastTriggerTs),
    sinceLastGlmCallStartSec:   secAgo(diag.lastGlmCallStartTs),
    sinceLastGlmCallSuccessSec: secAgo(diag.lastGlmCallSuccessTs),
    sinceLastGlmCallErrorSec:   secAgo(diag.lastGlmCallErrorTs),
    lastGlmError: diag.lastGlmError || null,
    // ── 配置快照（确认 filter/trigger 是否设错）
    settingsSummary: {
      apiUrl: settings.apiUrl,
      model: settings.model,
      myName: settings.myName,
      maxHistory: settings.maxHistory,
      replyDelay: settings.replyDelay,
      triggers: (settings.triggers || []).filter(s => s && s.trim()),
      filters:  (settings.filters  || []).filter(s => s && s.trim()),
      deletes:  (settings.deletes  || []).filter(s => s && s.trim()),
    },
  };
};

// 一键诊断：查询 content.js + 自身状态，结果同时打到日志区和 console
window.__PT_GLM_DIAG__ = async () => {
  const cs = window.__PT_GLM_INSPECT__();
  let pt = null;
  try {
    const tabs = await chrome.tabs.query({ url: 'https://pony.town/*' });
    if (tabs.length) {
      pt = await chrome.tabs.sendMessage(tabs[0].id, { type: 'PT_DEBUG_STATE' });
    }
  } catch (e) {
    pt = { error: e.message };
  }
  const summary = {
    '🎮 controller': {
      running: cs.running,
      busy: cs.busy + (cs.busyDurationSec ? `(${cs.busyDurationSec}s)` : ''),
      pendingTimer: cs.pendingTimerExists,
      history: `${cs.historyLength} 条 [${cs.historyRoles}]`,
      seenKeys: cs.seenKeysSize,
      expectingEcho: cs.expectingEchoSize,
      maxHistory: cs.settingsSummary.maxHistory,
    },
    '📥 消息流向 (累计计数)': {
      incoming:   cs.incomingCount,
      deduped:    cs.dedupedCount,
      echoMatched: cs.echoMatchedCount,
      isMine:     cs.isMineCount,
      filtered:   cs.filteredCount,
      pushed:     cs.pushedCount,
      triggerHit: cs.triggerHitCount,
      glmCallStart:   cs.glmCallStartCount,
      glmCallSuccess: cs.glmCallSuccessCount,
      glmCallError:   cs.glmCallErrorCount,
    },
    '⏱ 最近事件 (秒前)': {
      lastIncoming:    cs.sinceLastIncomingSec,
      lastPushed:      cs.sinceLastPushedSec,
      lastTrigger:     cs.sinceLastTriggerSec,
      lastGlmStart:    cs.sinceLastGlmCallStartSec,
      lastGlmSuccess:  cs.sinceLastGlmCallSuccessSec,
      lastGlmError:    cs.sinceLastGlmCallErrorSec,
      lastGlmErrorMsg: cs.lastGlmError,
    },
    '🌐 pony.town content script': pt || '⚠️ 未连接 (页面未刷新或无标签页)',
    '⚙️ 触发/过滤配置': {
      myName:   cs.settingsSummary.myName,
      triggers: cs.settingsSummary.triggers,
      filters:  cs.settingsSummary.filters,
    },
  };
  console.log('[PT GLM DIAG]', summary);

  // 在日志区也打一份简洁版（用户不必开 console）
  addLog('info', '────── 🔬 实时诊断 ──────');
  const cLine = `controller: running=${cs.running} busy=${cs.busy} 历史${cs.historyLength}[${cs.historyRoles}] pending=${cs.pendingTimerExists}`;
  addLog('info', cLine);
  const dLine = `计数: in=${cs.incomingCount} dedup=${cs.dedupedCount} filter=${cs.filteredCount} push=${cs.pushedCount} trig=${cs.triggerHitCount} glm=${cs.glmCallStartCount}/${cs.glmCallSuccessCount}/${cs.glmCallErrorCount}(s/o/e)`;
  addLog('info', dLine);
  const tLine = `最近事件秒前: in=${cs.sinceLastIncomingSec} push=${cs.sinceLastPushedSec} trig=${cs.sinceLastTriggerSec} glm=${cs.sinceLastGlmCallSuccessSec}`;
  addLog('info', tLine);
  if (cs.lastGlmError) addLog('error', `最近 GLM 错误: ${cs.lastGlmError}`);

  if (pt && pt.ok) {
    const pLine = `content: obs=${pt.observerAttached}/${pt.bodyObserverAttached} root连接=${pt.attachedRootConnected} 行数=${pt.currentLineCount} 上报=${pt.reportCount} 上次上报${pt.sinceLastReportSec}秒前 可见=${pt.pageVisibility}`;
    addLog('info', pLine);
  } else if (pt) {
    addLog('error', `content 端无响应: ${pt.error || 'unknown'}（pony.town 页面可能需要刷新）`);
  } else {
    addLog('error', 'content 端未连接（未找到 pony.town 标签页）');
  }
  addLog('info', '──────────────────────');
  return summary;
};

// 紧急修复入口：一键重置运行时状态 + 清空 history（保留 fullLog 和 seenKeys）
window.__PT_GLM_RESET__ = () => {
  busy = false;
  busyStartTime = 0;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  expectingEcho = [];
  history = [];
  chrome.storage.local.set({ history: [] });
  renderHistoryCount();
  addLog('info', '🔧 已紧急重置：history 清空、busy 释放、定时器清除');
  return 'reset OK';
};

// ── 启动 / 停止 ────────────────────────────
mainBtn.addEventListener('click', () => running ? stop() : start());

async function start() {
  await flushSettings(); // 同步落盘最新输入

  if (!settings.apiUrl) { addLog('error', '❌ 请填写 API URL'); return; }
  if (!settings.myName) { addLog('error', '❌ 请先填写"我的角色名"'); return; }
  if (!settings.apiKey && settings.apiPreset === 'glm') {
    addLog('error', '❌ 使用 GLM 官方接口必须填写 API Key'); return;
  }
  if (!settings.apiKey) addLog('info', '🔓 未设置 API Key，将以 local-model 模式调用（适用 LM Studio 等本地模型）');

  const tabs = await chrome.tabs.query({ url: 'https://pony.town/*' });
  if (!tabs.length) { addLog('error', '❌ 未找到 pony.town 标签页'); return; }

  let tabId = tabs[0].id;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PT_PING' });
  } catch {
    addLog('error', '❌ pony.town 页面脚本未就绪，请刷新该标签页后重试');
    return;
  }

  // 一次性同步当前页面历史（不触发 GLM）
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'PT_READ_HISTORY' });
    const msgs = resp?.messages || [];
    let added = 0;
    msgs.forEach(m => { if (silentIngest(m)) added++; });
    addLog('info', `📜 已同步 ${msgs.length} 条页面历史 (新增 ${added})`);
  } catch (e) {
    addLog('info', '⚠️ 同步页面历史失败：' + e.message);
  }

  running = true;
  // 强制重置可能卡死的运行时状态
  busy = false;
  busyStartTime = 0;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  touchActivity();
  startIdleLoop();
  mainBtn.textContent = '■ 停止监听';
  mainBtn.className   = 'btn btn-stop';
  setStatus('running', '监听中...');
  addLog('success', '🚀 监听已启动，等待新消息');
  if (settings.idleEnabled) {
    addLog('info', `💤 空闲 ${settings.idleSeconds}s 自动发句子已启用`);
  }
}

function stop() {
  running = false;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  stopIdleLoop();
  mainBtn.textContent = '▶ 启动监听';
  mainBtn.className   = 'btn btn-start';
  setStatus('', '已停止');
  addLog('info', '🛑 监听已停止');
}

// ── 消息处理 ──────────────────────────────
// 通道 1：实时 sendMessage（content script → 这里）
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'PT_NEW_CHAT') {
    handleIncoming(msg.message);
  }
});

// 通道 2：chrome.storage.local 作为可靠兜底
// 每条 pony.town 消息会以独立 key 存入，监听 onChanged 实时处理后清除该 key
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const toRemove = [];
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith('pt_glm_msg__')) continue;
    // 只处理"新增"（newValue 有、oldValue 无），跳过我们自己清空时触发的变化
    if (change.newValue && !change.oldValue) {
      try { handleIncoming(change.newValue); } catch (e) {
        console.warn('handleIncoming err:', e);
      }
      toRemove.push(key);
    }
  }
  if (toRemove.length) {
    chrome.storage.local.remove(toRemove).catch(() => {});
  }
});

// 通用：处理 storage 中所有 pt_glm_msg__ 开头的待处理消息
// 用于：a) 启动时 drain  b) 周期 polling 兜底
async function processPendingMessages(silent) {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all)
      .filter(k => k.startsWith('pt_glm_msg__'))
      .sort();
    if (!keys.length) return 0;
    for (const k of keys) {
      try { handleIncoming(all[k]); } catch (e) {
        console.warn('handleIncoming err:', e);
      }
    }
    await chrome.storage.local.remove(keys);
    if (!silent) addLog('info', `📥 处理了 ${keys.length} 条积压消息`);
    return keys.length;
  } catch (e) {
    console.warn('processPendingMessages err:', e);
    return 0;
  }
}

// 启动时 drain
async function drainPendingMessages() {
  return processPendingMessages(false);
}

// 通道 3：主动轮询 chrome.storage —— 不依赖任何事件回调，
// 即使 onMessage / onChanged 都"睡死"，这里也能把消息捞出来。
// 1.5 秒一次，hidden window 被节流后最差 1 分钟一次（仍能恢复）。
setInterval(() => {
  processPendingMessages(true).catch(() => {});
}, 1500);

// Watchdog：如果 busy 卡了超过 2 分钟（通常 fetch hang 或 await 卡死），
// 强制释放并恢复正常监听状态。每 30 秒检查一次。
setInterval(() => {
  if (busy && busyStartTime > 0 && Date.now() - busyStartTime > 120000) {
    console.warn('[PT GLM] busy 已卡 2 分钟，强制 release');
    addLog('error', '⚠️ GLM 调用挂起 2 分钟，强制重置（下次触发会重试）');
    busy = false;
    busyStartTime = 0;
    if (running) setStatus('running', '监听中...');
  }
}, 30000);

function msgKey(m) {
  return `${m.time || ''}|${m.name || ''}|${m.text || ''}|${m.channel || ''}`;
}

// 静默写入（用于启动时同步页面已有历史）
function silentIngest(m) {
  if (!m || !m.text) return false;
  const key = msgKey(m);
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);

  const isMine = settings.myName && m.name === settings.myName;

  // 完整日志：全部页面已有消息都收（标记 sync）
  addToFullLog({
    role: isMine ? 'assistant' : 'user',
    name: m.name || '(系统)', text: m.text,
    time: m.time || '', channel: m.channel || '', key, tag: 'sync',
  });

  // 同步时只把 自己消息 / 通过 filter 的他人消息 计入 GLM 历史
  if (!isMine && !matchesAny(m.text, settings.filters)) return false;

  history.push({
    role: isMine ? 'assistant' : 'user',
    name: m.name || '(系统)',
    text: m.text,
    time: m.time || '',
    channel: m.channel || '',
    key,
  });
  trimHistory();
  return true;
}

function handleIncoming(m) {
  if (!m || !m.text) return;
  diag.incomingCount++;
  diag.lastIncomingTs = Date.now();

  const key = msgKey(m);
  if (seenKeys.has(key)) {
    diag.dedupedCount++;
    return;
  }
  seenKeys.add(key);

  // 优先：检查是不是 GLM 刚刚发出去的消息回显
  // 用 normalize 比较，因为 pony.town 会把 \n 去掉、中文标点转英文
  const echoIdx = findEchoMatchIdx(m.text);
  if (echoIdx >= 0) {
    expectingEcho.splice(echoIdx, 1);
    diag.echoMatchedCount++;
    touchActivity(); // GLM 的输出回显 → 算作"GLM 最后一次发送"
    addToFullLog({
      role: 'assistant', name: m.name || settings.myName, text: m.text,
      time: m.time || '', channel: m.channel || '', key, tag: 'glm-echo',
    });
    return; // 已在发送时写入历史
  }

  const isMine = settings.myName && m.name === settings.myName;

  if (isMine) {
    diag.isMineCount++;
    // 用户在 pony.town 上手动输入的消息：写入历史，但不触发 GLM
    pushHistory({
      role: 'assistant', name: m.name, text: m.text,
      time: m.time || '', channel: m.channel || '', key,
    });
    addToFullLog({
      role: 'assistant', name: m.name, text: m.text,
      time: m.time || '', channel: m.channel || '', key, tag: 'manual',
    });
    addLog('outgoing', `→ ${m.name}: ${m.text}（手动）`);
    return;
  }

  if (!running) {
    // 未启动也写入完整日志，方便日后回看
    addToFullLog({
      role: 'user', name: m.name || '路人', text: m.text,
      time: m.time || '', channel: m.channel || '', key, tag: 'idle',
    });
    return;
  }

  // 1) 筛选 — 不命中则不入历史不触发，但仍进完整日志
  if (!matchesAny(m.text, settings.filters)) {
    diag.filteredCount++;
    addToFullLog({
      role: 'user', name: m.name || '路人', text: m.text,
      time: m.time || '', channel: m.channel || '', key, tag: 'filtered',
    });
    addLog('info', `（已过滤）${m.name || '?'}: ${m.text}`);
    return;
  }

  // 2) 入库
  diag.pushedCount++;
  diag.lastPushedTs = Date.now();
  pushHistory({
    role: 'user', name: m.name || '路人', text: m.text,
    time: m.time || '', channel: m.channel || '', key,
  });
  addToFullLog({
    role: 'user', name: m.name || '路人', text: m.text,
    time: m.time || '', channel: m.channel || '', key, tag: 'history',
  });
  addLog('incoming', `← ${m.name || '?'}: ${m.text}`);

  // 3) 触发器
  if (!matchesAny(m.text, settings.triggers)) return;

  diag.triggerHitCount++;
  diag.lastTriggerTs = Date.now();
  touchActivity(); // 命中触发 → 算作"GLM 最后一次收到消息"
  addLog('trigger', `⚡ 命中触发，准备调用 GLM`);
  scheduleReply();
}

function matchesAny(text, list) {
  const arr = (list || []).map(s => (s || '').trim()).filter(Boolean);
  if (arr.length === 0) return true; // 空列表 = 全通过
  return arr.some(s => text.includes(s));
}

function pushHistory(entry) {
  history.push(entry);
  trimHistory();
  persistHistory();
}

function trimHistory() {
  const max = settings.maxHistory || 20;
  if (history.length > max) {
    history = history.slice(-max);
  }
}

function persistHistory() {
  chrome.storage.local.set({ history }).catch(e => {
    console.warn('[PT GLM] persistHistory 写入失败:', e?.message);
    addLog('error', `⚠️ history 写入失败: ${e?.message || 'unknown'}`);
  });
  renderHistoryCount();
  if (settings.autoExport) scheduleAutoExport();
}

function renderHistoryCount() {
  countBadge.textContent = `历史 ${history.length} / 全 ${fullLog.length}`;
}

// ── GLM 调用 ──────────────────────────────
function scheduleReply() {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  const delay = Math.max(0, settings.replyDelay || 0) * 1000;
  pendingTimer = setTimeout(callGLMAndReply, delay);
}

async function callGLMAndReply() {
  pendingTimer = null;
  if (!running) return;
  if (busy) { addLog('info', '⏳ GLM 仍在响应中，跳过本次触发'); return; }
  busy = true;
  busyStartTime = Date.now();
  diag.glmCallStartCount++;
  diag.lastGlmCallStartTs = Date.now();
  setStatus('running', 'GLM 思考中...');

  const maxRetries = Math.max(0, settings.retryCount || 0);
  const retryMs    = Math.max(1, settings.retryDelaySec || 10) * 1000;

  let reply = null;
  try {
    const messages = buildGLMMessages();
    let attempt = 0;
    while (true) {
      try {
        if (attempt > 0) {
          setStatus('running', `重试 ${attempt}/${maxRetries} 中...`);
        }
        const r = (await callGLM(messages)).trim();
        if (!r) throw new Error('GLM 返回空内容');
        reply = r;
        diag.glmCallSuccessCount++;
        diag.lastGlmCallSuccessTs = Date.now();
        break;
      } catch (e) {
        attempt++;
        diag.glmCallErrorCount++;
        diag.lastGlmCallErrorTs = Date.now();
        diag.lastGlmError = e.message || String(e);
        const tries = `(${attempt}/${maxRetries + 1})`;
        if (attempt > maxRetries) {
          addLog('error', `❌ GLM 调用失败 ${tries}: ${e.message} — 放弃本轮`);
          setStatus('error', '调用失败，已放弃');
          return;
        }
        addLog('error', `⚠️ GLM 调用失败 ${tries}: ${e.message}`);
        addLog('info', `⏱ ${retryMs / 1000}s 后重试...`);
        setStatus('error', `${retryMs / 1000}s 后重试`);
        // 可中断等待：监听 running 状态
        const waited = await waitOrStop(retryMs);
        if (!waited || !running) {
          addLog('info', '🛑 重试被取消');
          return;
        }
      }
    }
    if (!reply) return;

    // 套用发送模板（如有），但历史里只记 GLM 纯净输出
    const sendText = applySendTemplate(reply);

    addLog('outgoing', `→ ${settings.myName || '我'}: ${sendText}`);

    // 加入待回显集合，避免 DOM 回显时重复入库
    addExpectingEcho(sendText);

    // 主动写入历史（不等回显）
    const echoKey = `__GLM__|${Date.now()}|${reply}`;
    seenKeys.add(echoKey);
    const nowTime = new Date().toLocaleTimeString('zh', { hour12: false });
    pushHistory({
      role: 'assistant',
      name: settings.myName || '我',
      text: reply,
      time: nowTime,
      channel: '',
      key: echoKey,
    });
    addToFullLog({
      role: 'assistant', name: settings.myName || '我',
      text: reply, time: nowTime, channel: '',
      key: echoKey, tag: 'glm-out',
    });

    // 发到 pony.town
    const tabs = await chrome.tabs.query({ url: 'https://pony.town/*' });
    if (!tabs.length) { addLog('error', '未找到 pony.town 标签'); return; }
    const sendResp = await chrome.tabs.sendMessage(
      tabs[0].id, { type: 'PT_SEND_MESSAGE', text: sendText }
    ).catch(e => ({ ok: false, err: e.message }));
    if (!sendResp?.ok) addLog('error', `发送失败：${sendResp?.err || 'unknown'}`);
    touchActivity();
  } catch (e) {
    addLog('error', `运行时出错: ${e.message}`);
    setStatus('error', '出错');
  } finally {
    busy = false;
    if (running) setStatus('running', '监听中...');
  }
}

// ── 空闲句子池 ────────────────────────────
function touchActivity() {
  lastActivityTs = Date.now();
}

function startIdleLoop() {
  if (idleCheckTimer) return;
  idleCheckTimer = setInterval(checkIdle, 5000);
}
function stopIdleLoop() {
  if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null; }
}

async function checkIdle() {
  if (!running || !settings.idleEnabled) return;
  if (busy) return; // GLM 正在响应/重试时不打扰
  const now = Date.now();
  const idleMs     = (settings.idleSeconds     || 60) * 1000;
  const intervalMs = (settings.idleIntervalSec || 60) * 1000;
  if (now - lastActivityTs < idleMs) return;
  if (now - lastIdleSendTs < intervalMs) return;

  const pool = (settings.idleSentences || []).map(s => (s || '').trim()).filter(Boolean);
  if (pool.length === 0) return;
  const sentence = pool[Math.floor(Math.random() * pool.length)];

  lastIdleSendTs = now;
  touchActivity();
  await sendIdleSentence(sentence);
}

async function sendIdleSentence(sentence) {
  // 不走任何后处理：不套模板、不应用 maxSendLength，只受 pony.town 硬上限 400
  const text = sentence.length > 400 ? sentence.slice(0, 400) : sentence;
  addLog('outgoing', `→ 💤 ${text}`);
  const key = `__IDLE__|${Date.now()}|${text}`;
  seenKeys.add(key);
  addExpectingEcho(text); // 防止 DOM 回显时被当成手动输入
  addToFullLog({
    role: 'assistant', name: settings.myName || '我', text,
    time: new Date().toLocaleTimeString('zh', { hour12: false }),
    channel: '', key, tag: 'idle-spam',
  });
  // 注意：不进 GLM 上下文 history，避免污染对话
  try {
    const tabs = await chrome.tabs.query({ url: 'https://pony.town/*' });
    if (!tabs.length) { addLog('error', '空闲发送失败：无 pony.town 标签'); return; }
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'PT_SEND_MESSAGE', text });
  } catch (e) {
    addLog('error', `空闲发送失败：${e.message}`);
  }
}

// 可中断 sleep：用户停止监听时立即返回 false
function waitOrStop(ms) {
  return new Promise(resolve => {
    const step = 250;
    let elapsed = 0;
    const t = setInterval(() => {
      if (!running) { clearInterval(t); resolve(false); return; }
      elapsed += step;
      if (elapsed >= ms) { clearInterval(t); resolve(true); }
    }, step);
  });
}

// 单条 message content 的硬上限（防止 merge 累积或 history 异常导致 prompt 爆炸）
const MAX_CONTENT_LEN = 600;
// 整个 messages 数组的 content 字符总上限（保守估算 ~3K tokens）
const MAX_TOTAL_CONTENT_LEN = 6000;

function buildGLMMessages() {
  const max = settings.maxHistory || 20;
  const tail = history.slice(-max);
  const deletes = (settings.deletes || []).map(s => (s || '').trim()).filter(Boolean);

  const cleaned = tail.map(h => {
    let text = h.text;
    for (const d of deletes) text = text.split(d).join('');
    return { role: h.role, name: h.name, text: text.trim() };
  }).filter(h => h.text);

  // 1) 同 role 连续 → 合并/去重
  const merged = [];
  for (const h of cleaned) {
    const role = h.role === 'assistant' ? 'assistant' : 'user';
    const content = role === 'user' ? `${h.name || '路人'}: ${h.text}` : h.text;
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      if (normalizeForEcho(last.content) === normalizeForEcho(content)) continue;
      last.content = last.content + '\n' + content;
      continue;
    }
    merged.push({ role, content });
  }

  // 2) 每条 content 限长
  for (const m of merged) {
    if (m.content.length > MAX_CONTENT_LEN) {
      m.content = m.content.slice(0, MAX_CONTENT_LEN);
    }
  }

  // 3) 从末尾倒序累积，确保总长不超限（保留最新对话，丢弃最旧的）
  let totalLen = 0;
  const trimmed = [];
  for (let i = merged.length - 1; i >= 0; i--) {
    const len = merged[i].content.length;
    if (totalLen + len > MAX_TOTAL_CONTENT_LEN && trimmed.length > 0) break;
    totalLen += len;
    trimmed.unshift(merged[i]);
  }

  // 4) 拼装最终 messages：system + 严格 user/assistant 交替
  const messages = [];
  if (settings.characterPrompt && settings.characterPrompt.trim()) {
    messages.push({ role: 'system', content: settings.characterPrompt });
  }
  messages.push(...trimmed);

  // 5) 末尾必须是 user（本地模型对此非常敏感）
  if (messages[messages.length - 1]?.role !== 'user') {
    messages.push({ role: 'user', content: '（请回应）' });
  }
  return messages;
}

async function callGLM(messages) {
  const url = settings.apiUrl || API_PRESETS.glm;
  // LM Studio / 本地模型可能不验证 Authorization，但加上不会有副作用
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${settings.apiKey || 'local-model'}`,
  };

  // fetch 默认无超时；本地模型偶发 hang 会让 callGLMAndReply 永远 await，
  // busy 永不释放 → 后续所有触发都被跳过。60s 超时 + AbortController 修复这个。
  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 60000);

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model || 'glm-4-flash',
        messages,
        temperature: 0.8,
      }),
      signal: abortCtrl.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('请求超时（60s）');
    throw e;
  }
  clearTimeout(timeoutId);
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  let content = data?.choices?.[0]?.message?.content || '';
  content = String(content).trim();
  // 剥离常见 markdown 代码块
  const fence = content.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  if (fence) content = fence[1].trim();
  // pony.town 单条上限 400
  if (content.length > 400) content = content.slice(0, 400);
  return content;
}

// 发送模板：用 {reply} 占位符表示 GLM 输出。
// 模板为空 → 直接发送 reply 原文。
// 套模板后总长度若超过 settings.maxSendLength，会按比例截短 reply 部分，
// 保证模板本身（如频道前缀 /p、艾特名等）完整保留。
function applySendTemplate(reply) {
  const tpl = (settings.sendTemplate || '');
  const limit = Math.max(10, Math.min(400, settings.maxSendLength || 150));
  let finalText;

  if (!tpl) {
    finalText = reply.length > limit ? reply.slice(0, limit) : reply;
  } else if (tpl.includes('{reply}')) {
    const count = (tpl.match(/\{reply\}/g) || []).length;
    const fixedLen = tpl.length - count * '{reply}'.length;
    const maxReplyLen = Math.max(0, Math.floor((limit - fixedLen) / count));
    const trimmed = reply.length > maxReplyLen ? reply.slice(0, maxReplyLen) : reply;
    finalText = tpl.replace(/\{reply\}/g, trimmed);
  } else {
    // 没有 {reply} 占位 → 当作前缀拼接
    const maxReplyLen = Math.max(0, limit - tpl.length);
    const trimmed = reply.length > maxReplyLen ? reply.slice(0, maxReplyLen) : reply;
    finalText = tpl + trimmed;
  }

  // 兜底：硬上限 limit（pony.town 自己也有 400 上限）
  if (finalText.length > limit) finalText = finalText.slice(0, limit);
  if (finalText.length > 400)   finalText = finalText.slice(0, 400);
  return finalText;
}

// 待回显集合的写入：15s 自动过期清理，防止匹配失败时无限堆积
function addExpectingEcho(text) {
  expectingEcho.push(text);
  setTimeout(() => {
    const i = expectingEcho.indexOf(text);
    if (i >= 0) expectingEcho.splice(i, 1);
  }, 15000);
}

// pony.town 会把发送内容做修改：去掉换行、中文标点转英文等。
// 这里把两边都"标准化"后再比较，让 expectingEcho 能正确命中 DOM 回显。
function normalizeForEcho(s) {
  return String(s || '')
    .replace(/\s+/g, '')            // 去掉所有空白（含换行、空格、tab）
    .replace(/[，]/g, ',')           // 中文逗号 → 英文
    .replace(/[。]/g, '.')           // 中文句号
    .replace(/[？]/g, '?')           // 中文问号
    .replace(/[！]/g, '!')           // 中文感叹号
    .replace(/[：]/g, ':')           // 中文冒号
    .replace(/[；]/g, ';')           // 中文分号
    .replace(/[""]/g, '"')          // 中文双引号
    .replace(/['']/g, "'")          // 中文单引号
    .replace(/[（]/g, '(').replace(/[）]/g, ')'); // 中文括号
}

// 在 expectingEcho 里查找跟 m.text 标准化后等价的项
function findEchoMatchIdx(text) {
  const target = normalizeForEcho(text);
  if (!target) return -1;
  for (let i = 0; i < expectingEcho.length; i++) {
    if (normalizeForEcho(expectingEcho[i]) === target) return i;
  }
  return -1;
}

// ── 完整去重日志 ──────────────────────────
// fullLog 收录所有去重通过的消息（不受 maxHistory 限制）
// tag 描述消息类型：'history'/'filtered'/'manual'/'glm-out'/'glm-echo'/'idle'/'sync'
function addToFullLog(entry) {
  const item = {
    ts:      Date.now(),
    time:    entry.time || '',
    name:    entry.name || '',
    text:    entry.text || '',
    role:    entry.role || 'user',
    channel: entry.channel || '',
    key:     entry.key || '',
    tag:     entry.tag || '',
  };
  fullLog.push(item);
  if (fullLog.length > MAX_FULL_LOG) {
    fullLog = fullLog.slice(-MAX_FULL_LOG);
  }
  scheduleFullLogPersist();
}

let fullLogPersistTimer = null;
function scheduleFullLogPersist() {
  if (fullLogPersistTimer) clearTimeout(fullLogPersistTimer);
  fullLogPersistTimer = setTimeout(() => {
    chrome.storage.local.set({ fullLog });
    if (settings.fullLogAutoExport) doFullLogExport(false);
  }, 1500);
}

let lastFullLogUrl = null;
async function doFullLogExport(manual) {
  const lines = fullLog.map(h => {
    const role = h.role === 'assistant' ? 'GLM ' : (h.role === 'user' ? 'IN  ' : 'SYS ');
    const tag  = h.tag ? `<${h.tag}> ` : '';
    return `[${h.time || ''}] [${role}] ${tag}${h.name || '?'}: ${h.text}`;
  });
  const text = lines.join('\n') + '\n';
  const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename: settings.fullLogFilename || 'pt_glm_fulllog.txt',
      conflictAction: 'overwrite',
      saveAs: false,
    });
    if (manual) addLog('success', `📦 已导出完整日志 ${fullLog.length} 条`);
    setTimeout(() => chrome.downloads.erase({ id: downloadId }).catch(() => {}), 2000);
  } catch (e) {
    if (manual) addLog('error', `完整日志导出失败: ${e.message}`);
  } finally {
    if (lastFullLogUrl) URL.revokeObjectURL(lastFullLogUrl);
    lastFullLogUrl = url;
  }
}

// ── 自动导出 ──────────────────────────────
let autoExportTimer = null;
let lastExportUrl   = null;

function scheduleAutoExport() {
  if (autoExportTimer) clearTimeout(autoExportTimer);
  autoExportTimer = setTimeout(() => doExport(false), 1200);
}

async function doExport(manual) {
  const lines = history.map(h => {
    const tag = h.role === 'assistant'
      ? `[${h.time || ''}] (${h.name || '我'} / GLM)`
      : `[${h.time || ''}] ${h.name || '?'}`;
    return `${tag}: ${h.text}`;
  });
  const text = lines.join('\n') + '\n';

  const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename: settings.exportFilename || 'pt_glm_chat.txt',
      conflictAction: 'overwrite',
      saveAs: false,
    });
    if (manual) addLog('success', `📥 已导出 ${history.length} 条历史`);
    // 静默清理下载记录（文件保留）
    setTimeout(() => {
      chrome.downloads.erase({ id: downloadId }).catch(() => {});
    }, 2000);
  } catch (e) {
    addLog('error', `导出失败: ${e.message}`);
  } finally {
    if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
    lastExportUrl = url;
  }
}

// ── 工具函数 ──────────────────────────────
function setStatus(state, text) {
  dot.className = 'dot' + (state ? ' ' + state : '');
  statusText.textContent = text;
}

const MAX_LOG = 200;
function addLog(type, text) {
  const el = document.createElement('div');
  el.className = `le ${type}`;
  const hms = new Date().toLocaleTimeString('zh', { hour12: false });
  el.textContent = `[${hms}] ${text}`;
  logEl.appendChild(el);
  while (logEl.children.length > MAX_LOG) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}
