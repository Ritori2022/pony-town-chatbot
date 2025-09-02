# 🐎 Pony Town 聊天机器人

[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

一个功能强大的小马镇 (Pony Town) 自动聊天机器人，支持多种AI模型驱动的智能对话、角色扮演、朗读等功能。

## ✨ 主要功能

- 🤖 **智能对话**: 支持 ChatGPT 和 Llama3-7B 多种AI模型
- 🎭 **角色扮演**: 内置多个角色模板，支持自定义角色
- 📚 **文本朗读**: 自动朗读指定文本内容
- 🔄 **自动重连**: 智能检测断线并自动重连
- 📸 **自动截图**: 定时保存游戏截图
- 💬 **聊天记录**: 自动获取并保存聊天记录

## 🚀 快速开始

### 环境要求
- Node.js 14+
- Python 3.7+ (如需使用 Llama3 API)
- Chrome/Chromium 浏览器

### 安装依赖
```bash
npm install
```

### 基础使用

1. **启动浏览器环境**:
   ```bash
   node browser.js        # 启动 Pony Town 浏览器
   node browser2.js       # 启动 ChatGPT 浏览器 (可选)
   ```

2. **运行聊天机器人**:
   ```bash
   node auto_pt_gpt.js    # 使用 ChatGPT 驱动
   # 或
   node auto_pt.js        # 使用 Llama3 API 驱动
   ```

3. **其他功能脚本**:
   ```bash
   node welcome.js        # 欢迎新玩家
   node auto_reading.js   # 自动朗读文本
   node screenshot.js     # 定时截图
   ```

## 📁 项目结构

```
├── chat/              # 聊天相关脚本
├── game/              # 游戏功能脚本  
├── tools/             # 实用工具
├── test/              # 测试文件
├── reading/           # 朗读相关文件
├── additional/        # 备用脚本
├── common.js          # 公共函数库
└── index.js           # HTTP服务器入口
```

## 🛠️ 核心脚本说明

### 聊天机器人
- `auto_pt_gpt.js` - ChatGPT 网页版驱动的聊天机器人
- `auto_pt.js` / `auto_pt2.js` - Llama3 API 驱动的聊天机器人（不同角色）
- `auto_os.js` - 智能独白系统（10分钟无人回应时触发）

### 实用工具
- `browser.js` - 启动 Pony Town 浏览器实例
- `browser2.js` - 启动 ChatGPT 浏览器实例  
- `rejoin.js` - 自动重连服务器
- `screenshot.js` - 自动截图功能
- `afk.js` - 防挂机脚本

### 文本处理
- `auto_reading.js` - 自动朗读系统
- `get_talk.js` - 获取聊天记录
- `welcome.js` - 欢迎新玩家

## ⚙️ 配置说明

### AI 模型配置
- **ChatGPT**: 需要在浏览器中登录 ChatGPT 账号
- **Llama3**: 需要配置相应的 API 端点和密钥

### 角色设定
通过修改提示词文件自定义机器人角色：
- `prompt_introduce.txt` - 角色介绍
- `prompt_orign.txt` - 原始提示词

## 🎮 使用建议

1. **首次使用**: 建议先运行 `min_test.js` 进行基本功能测试
2. **稳定运行**: 配合 `rejoin.js` 确保连接稳定性
3. **多功能组合**: 可同时运行多个脚本实现复合功能

## 🔧 故障排除

常见问题及解决方案：
- 浏览器连接失败：检查端口占用情况
- ChatGPT 无响应：使用 `recreate.js` 重置连接
- 聊天记录获取失败：确保聊天窗口已打开

## 🗺️ 更新计划

- [x] 函数模块化
- [ ] 计算机视觉识别新玩家
- [ ] 增强提示词安全性
- [ ] 扩展书籍库
- [ ] 角色切换功能
- [ ] 批处理自动化

## 📞 联系方式

如有问题或建议，欢迎通过以下方式联系：
- QQ: 1207991271 (请备注：小马镇机器人)

## 📄 许可证

本项目采用 ISC 许可证 - 详见 [LICENSE](LICENSE) 文件

---

> 💡 **开发者寄语**: 感谢社区的支持与反馈！这个项目从个人兴趣出发，希望为小马镇玩家带来更有趣的游戏体验。虽然更新可能不会很频繁，但会尽力保持机器人的稳定运行。祝大家游戏愉快！🎉



