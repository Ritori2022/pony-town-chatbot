# 🐴 PT GLM 聊天机器人

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore/) [![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)]() [![中文](https://img.shields.io/badge/Lang-中文-red.svg)]()

基于 Chrome 扩展实现的 [pony.town](https://pony.town/) 聊天机器人，使用 GLM 文本模型（或 LM Studio 等任意 OpenAI 兼容接口）自动监听并回复聊天消息。直接读 DOM、走真实输入框发送，不需要 Puppeteer、不需要后端进程。

> 项目历经多次迭代，最初是基于 Puppeteer 的 Node.js 框架（见 [`archive/`](./archive)），现已重写为更轻量、更稳定的浏览器扩展形式。

---

## ✨ 特性

### 核心
- **纯前端浏览器扩展** — 无需后端服务，装好就能用
- **OpenAI 兼容协议** — 支持 GLM 官方 API、LM Studio 本地模型、任意自定义端点
- **角色提示词** — system prompt 内置可视化编辑器，支持长文本设定
- **历史上下文** — 按设定条数自动保留对话历史，发送给模型时严格保持 user/assistant 交替

### 消息处理
- **触发字段** — 多条字符串，任一命中才会调用模型回复（避免被路人消息刷屏）
- **筛选字段** — 多条字符串，只有命中的消息才进入历史（缩小上下文）
- **删除字段** — 发送给模型前从消息上做字符串删除（去掉 @ 前缀等）
- **发送模板** — 用 `{reply}` 占位符包装模型输出（如频道前缀 `/p {reply}`）
- **发送长度限制** — 模板套用后超长自动按比例截短 reply 部分

### 稳定性（多重防御）
- **三层 DOM 监听** — chat-log observer + body subtree observer + 2s 主动扫描兜底
- **双通道消息** — `chrome.runtime.sendMessage` 实时通道 + `chrome.storage.local` 可靠兜底
- **三通道接收** — onMessage + onChanged + 1.5s 主动 polling，防 service worker 休眠丢消息
- **内容指纹去重** — 消息按 `时间|名字|文本|频道` 去重，免疫 pony.town 的 100 行 DOM 节点复用机制
- **失败自动重试** — 可配置重试次数和间隔，AbortController 60s 超时防 fetch 挂起
- **busy watchdog** — 调用卡住超过 2 分钟自动释放，不会死锁
- **紧急重置按钮** — 一键清 history + 释放 busy + 清定时器
- **实时诊断按钮** — 一键打印消息流向计数器，秒级定位消息掉在哪一步

### 体验
- **空闲句子池** — 设定时长无人触发时，从预填句子池中随机发一句"自言自语"（不进上下文，原文直发）
- **完整去重日志** — 所有去重通过的消息（触发/过滤/自己/手动/模型输出）全部留底，最多 5000 条
- **自动导出** — GLM 历史和完整日志可设置自动导出到本地文件
- **暗色主题 UI** — 配色舒适，配置项分组折叠

---

## 📦 安装

1. 下载本仓库（`git clone` 或 download zip）
2. 打开 `chrome://extensions/`，右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本仓库根目录
4. 装好后浏览器工具栏会出现 🐴 图标

---

## 🚀 使用流程

1. **打开 [pony.town](https://pony.town/)** 并登录进入角色
2. **点击工具栏 🐴 图标** → 弹窗里点「打开控制面板」（独立窗口）
3. **填写必填项**：
   - **API URL** — 选「GLM 官方」或「LM Studio」自动填，也可自定义
   - **API Key** — GLM 必填，LM Studio 留空即可
   - **模型名称** — 如 `glm-4-flash` 或 LM Studio 中加载的模型
   - **我的角色名** — pony.town 中你的角色名（用于识别 GLM 自己的回复，**很重要**）
4. **可选配置**：
   - **触发字段** — 留空则任何进入历史的消息都触发；填入则只有包含该字符串才触发
   - **筛选字段** — 留空则全部其他玩家消息都计入历史
   - **删除字段** — 发送给模型前做字符串删除
   - **发送模板** — 比如 `/p {reply}` 强制把回复发到组队频道
5. **点「▶ 启动监听」** — 状态点变绿即开始工作

---

## ⚙️ 字段详解

| 字段 | 作用 | 示例 |
|---|---|---|
| 触发字段 | 任一命中才调用 GLM 回复 | `@茴` `茴茴` |
| 筛选字段 | 只有命中才计入历史（缩窄上下文） | `[本地]` |
| 删除字段 | 发送给 GLM 前去掉这些字符串 | `@茴 ` |
| 发送模板 | 发到 pony.town 前包装一层 | `/p {reply}` |
| 历史长度 | 上下文保留几条对话 | `20` |
| 发送最大字符数 | 含模板的总长度 | `150` |
| 失败重试 | 模型调用失败时重试几次 | `3 次 / 10s 间隔` |

所有多条字段都支持 +/- 增删行，纯字符串 `includes` 匹配（不是正则）。

---

## 💤 空闲句子池

如果一段时间内 GLM 既没收到能触发的消息、也没成功发送过回复，自动从句子池里随机抽一句发出，模拟"自言自语"。

- **空闲秒数** — 多久算空闲（基于"最后一次 GLM 触发或发送"）
- **最小发送间隔** — 防止刚发完又立刻发下一句
- **句子池** — 多行 +/- 增删，预填 10 句符合默认「茴」角色设定的句子

> ⚠️ 注意：空闲句子**原文直发**，不套发送模板，不受发送最大字符数限制（仅受 pony.town 400 上限）。

---

## 🔬 诊断功能

点击底部「🔬 诊断」按钮，会在日志区打印实时状态：

```
controller: running=true busy=false 历史10[uauauauaua] pending=false
计数: in=204 dedup=104 filter=0 push=49 trig=49 glm=49/48/6(s/o/e)
最近事件秒前: in=159 push=178 trig=178 glm=159
content: obs=true/true root连接=true 行数=100 上报=100 上次上报159秒前 可见=visible
```

通过计数器变化能精确定位卡死时消息掉在哪一步：
- `incoming` 不动 → content 端没上报（页面问题）
- `dedup` 一直涨 → 全被去重了
- `filter` 在涨 → 你的筛选字段拦掉了
- `push` 涨但 `trig` 不涨 → 触发字段没匹配上
- `trig` 涨但 `glm` 不动 → setTimeout 卡了
- `glm` 的错误数（最后一个）在涨 → fetch 出错，看「最近 GLM 错误」

控制台输入 `__PT_GLM_INSPECT__()` 可看更详细的诊断结构。

---

## 🆘 紧急按钮

- **🔧 紧急重置** — 清空 GLM 上下文 history、释放卡死的 busy 状态、清除定时器（保留完整日志）
- **清空** — 清空日志区 + GLM 历史；可选是否一并清空完整日志

控制台命令：
- `__PT_GLM_INSPECT__()` — 返回详细状态对象
- `__PT_GLM_DIAG__()` — 同上但额外查询 content script 状态，写入日志
- `__PT_GLM_RESET__()` — 紧急重置（等同按钮）

---

## 📁 文件结构

```
.
├── manifest.json        # Chrome 扩展 manifest V3
├── background.js        # Service worker（仅做窗口清理）
├── popup.html / .js     # 工具栏弹窗，负责开/聚焦控制窗口
├── controller.html / .js # 主控制面板（独立窗口）
├── content.js           # 注入 pony.town 的脚本，DOM 监听 + 消息发送
├── icon.png
├── 角色提示词.txt        # 默认角色「茴」的 system prompt
├── 交互资料.txt          # pony.town DOM 结构技术笔记
└── archive/             # 旧版 Puppeteer Node.js 框架（已弃用，仅作记录）
```

---

## 🔧 故障排除

| 现象 | 排查 |
|---|---|
| 启动报「页面脚本未就绪」 | 刷新 pony.town 页面后重试 |
| 控制面板里命令未定义 | 关闭控制窗口重新打开（弹出窗不会跟随扩展重载） |
| 长时间运行后不读消息 | 按🔬诊断看 content 上次上报时间，若 >60s 多半是 DOM 监听挂了，按 F5 刷新 |
| GLM 频繁报 429 | 调高「回复延迟」或换成 LM Studio 本地模型 |
| 自己的回复被当成路人消息触发 | 检查「我的角色名」是否与 pony.town 显示一致（不含方括号） |

---

## 🛡️ 隐私

- API Key 仅保存在浏览器 `chrome.storage.local`，不会上传到任何第三方服务
- 所有 GLM 请求直接从浏览器发往你填的 API URL，不经过中转
- 完整日志保存在本地，需手动导出或在「设置」中关闭自动导出

---

## 📜 许可

ISC（同旧版）。仅供个人/研究用途，不要用于刷屏、骚扰或违反 pony.town 服务条款的行为。

---

## 🗂️ 历史版本

旧版基于 Puppeteer + Node.js 的自动化框架（`auto_pt_gpt.js`、`browser.js`、`rejoin.js` 等）保留在 [`archive/`](./archive) 目录作为历史记录，主要不再维护。详情见 [archive/README.md](./archive/README.md)。
