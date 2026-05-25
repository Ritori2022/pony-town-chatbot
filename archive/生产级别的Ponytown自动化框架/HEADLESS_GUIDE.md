# 🎯 无头模式自动化指南

喵～这是Luna为你准备的无头自动化完整方案！

## 💡 核心原理

使用`userDataDir`保存浏览器的登录状态（cookies、localStorage等），这样就可以：
1. **第一次**：有头模式手动登录
2. **之后**：无头模式自动进入游戏

```javascript
const browser = await puppeteer.launch({
  headless: true,
  userDataDir: './browser_data'  // 关键！
});
```

## 🚀 快速开始

### 步骤1：首次登录（一次性操作）

```bash
cd ponytown
node first_login.js
```

浏览器会打开，请：
1. 访问 https://pony.town/
2. 用GitHub账号登录
3. 进入游戏
4. 确认成功后按 `Ctrl+C` 退出

你的登录状态会被保存到 `ponytown/browser_data/` 目录。

### 步骤2：无头自动运行

```bash
node headless_play.js
```

脚本会：
- 启动无头浏览器
- 使用保存的登录状态
- 自动访问Ponytown
- 开始监听和发送消息

## ⚠️ 重要提示

### 可能遇到的问题

#### 1. 仍然显示"Access denied"

即使使用了`userDataDir`，Ponytown的Cloudflare保护可能仍会检测到无头模式。

**解决方案**：
- 方案A：使用有头模式（`headless: false`）
- 方案B：使用远程调试连接（见主README）
- 方案C：使用`Xvfb`虚拟显示（Linux服务器）

#### 2. Session过期

如果长时间未使用，GitHub session可能过期。

**解决方案**：重新运行 `first_login.js`

#### 3. 无法在服务器上运行first_login.js

服务器没有图形界面，无法打开浏览器窗口。

**解决方案**：
```bash
# 在本地机器上运行首次登录
node first_login.js

# 然后把browser_data目录打包上传到服务器
tar -czf browser_data.tar.gz browser_data/
scp browser_data.tar.gz user@server:/path/to/ponytown/
ssh user@server "cd /path/to/ponytown && tar -xzf browser_data.tar.gz"
```

## 🔬 高级技巧

### 方法1：使用Xvfb（Linux无头服务器）

Xvfb可以创建虚拟显示，让有头浏览器在无显示器的服务器上运行：

```bash
# 安装Xvfb
sudo apt-get install xvfb

# 使用Xvfb运行
xvfb-run -a node first_login.js
```

### 方法2：使用Puppeteer的新模式

Puppeteer的新版本支持 `headless: 'new'`，比传统无头模式更难被检测：

```javascript
const browser = await puppeteer.launch({
  headless: 'new',  // 新的无头模式
  userDataDir: USER_DATA_DIR
});
```

### 方法3：使用代理和User-Agent轮换

```javascript
const browser = await puppeteer.launch({
  headless: true,
  userDataDir: USER_DATA_DIR,
  args: [
    '--proxy-server=http://your-proxy:8080',
    '--disable-blink-features=AutomationControlled'
  ]
});

// 设置真实的User-Agent
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...');
```

## 📊 对比：不同方案

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **有头+手动登录** | 100%成功 | 需要图形界面 | ⭐⭐⭐⭐⭐ |
| **有头+远程调试** | 稳定可靠 | 浏览器需常驻 | ⭐⭐⭐⭐⭐ |
| **无头+userDataDir** | 完全自动化 | 可能被检测 | ⭐⭐⭐ |
| **Xvfb+有头** | 服务器可用 | 配置复杂 | ⭐⭐⭐⭐ |

## 🎯 你的原项目是如何做到的？

经过Luna的分析，你的原项目 `pony-town-chatbot` 实际上是：

1. **启动浏览器**（有头，端口9222）
   ```bash
   node browser.js  # headless: false
   ```

2. **手动登录**
   - 你在浏览器中访问pony.town
   - 使用GitHub登录
   - 进入游戏

3. **自动化脚本连接**
   ```bash
   node auto_pt_gpt.js  # 连接到9222端口
   ```

所以其实是**有头模式一直运行 + 自动化脚本连接**的方式喵～

## 💾 browser_data目录的作用

这个目录保存了：
- 🍪 Cookies（包括GitHub登录token）
- 💾 localStorage/sessionStorage
- 🔐 缓存的证书
- 📝 浏览历史
- ⚙️ 浏览器设置

**安全提示**：
- ⚠️ 不要提交到Git（已在.gitignore中）
- ⚠️ 包含敏感信息，妥善保管
- ⚠️ 定期清理过期数据

## 🐛 调试技巧

如果无头模式不工作，添加调试选项：

```javascript
const browser = await puppeteer.launch({
  headless: true,
  userDataDir: USER_DATA_DIR,
  dumpio: true,  // 显示浏览器日志
  args: [
    '--enable-logging',
    '--v=1'
  ]
});

// 监听页面错误
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', error => console.log('PAGE ERROR:', error));
```

## 📚 参考资料

- [Puppeteer userDataDir文档](https://pptr.dev/api/puppeteer.browserslaunchoptions)
- [反检测最佳实践](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Cloudflare绕过技巧](https://github.com/ultrafunkamsterdam/undetected-chromedriver)

---

**Made with 喵 by Luna** ฅ^•ﻌ•^ฅ

*Nyx的悄悄话：userDataDir是合法且正确的做法...但Cloudflare的多维度检测仍然是个挑战呢*
