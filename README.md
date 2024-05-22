pony-town-chatbot 小马镇聊天机器人

用于在小马镇自动获取聊天记录并且回复的机器人

可以朗读书籍，对话，玩角色扮演游戏

开发者的话：感谢一周多来大家的支持;原本只是突发奇想做个交互机器人给自己玩，没想到能吸引这么多玩家。
实在感到惊喜;不过由于时间原因，之后可能就没法做更多的更新了;会尽量保持机器人在线供游玩。
再次感谢;祝游戏愉快。2024/05/23

如果没有node.js请先下载
使用npm install安装依赖

使用说明：
需要先使用browser.js打开的测试浏览器打开pony town并且打开聊天记录。
使用browser2.js打开chatgpt.com。
之后按需要启用各种脚本连接到浏览器进行自动化操作。

文件作用如下：
afk.js://用来挂机的脚本，每一分钟按一下数字键0

auto_os.js//十分钟没人搭话就自言自语，读取prompt_introduce.txt的提示词，之后使用llama3 -7b api即时生成独白

auto_os2.js//三分钟没人搭话就自言自语,从oc.txt中每分钟读一句

auto_pt_gpt.js//使用chatgpt网页版来驱动聊天机器人的脚本

auto_pt.js//使用llama3-7b api 来驱动pt聊天机器人的自动聊天脚本

auto_pt2.js//使用llama3-7b api 来驱动pt聊天机器人的自动聊天脚本，更换了角色

auto_read2.js//用于自动阅读独白的脚本，三分钟没人搭话就自言自语,从oc.txt中每分钟读一句

auto_reading.js//用于朗读的脚本，从dianbo_changyuantu.txt'读取内容，每10秒读一句，进度保存在progress.txt里

browser.js//启动浏览器用于连接pony.town

browser2.js//启动浏览器用于连接chatgpt.com

get_talk_60s.js//每分钟获取聊天记录的脚本,加入到chat_logs.csv中

get_talk.js//获取聊天框中所有记录的脚本，打印在控制台上，用于测试获取聊天记录功能

gpt_test.js//发送一次消息给chatgpt.com并获取回答的脚本，用于测试chatgpt.com的连接

gpt.py#用于在run_gpt.js和llama3-7b api之间传递消息的python脚本

min_test.js//自动化运行的最小可行测试

pt_game.js//用于单人桌面角色扮演的脚本，接受玩家聊天输入，数字选择主题，字母选择选项

rejoin.js//用于自动重连的脚本，每20秒查找一次safe chinese按钮，找到就点

run_gpt.js//用来通过python获得llama3-7b回复的脚本

screenshot.js//每5分钟自动截图一次的脚本

sned_message.js//发送一次聊天内容到pt的脚本

test.py#单独运行用于测试llama3-7b的脚本，发送hello给llama3，并打印回答。

test1.js//连接到browser.js的测试，使用browser.js开启的测试浏览器继续进行自动化操作

welcome.js//用于发送欢迎语的脚本，从oc.txt中读取，有人发言就发送欢迎语，每分钟最多发一次，通过按键5和6控制小马的睡眠和唤醒

2024/05/21
recreate.js//用于将chatgpt网页版从异常错误中恢复

2024/05/22
将pt_game的函数模块化入common.js中，供auto_pt_gpt复用
更新了一下文件组织结构：additional是备用文件，chat是聊天脚本文件，game是游戏脚本文件，test是测试用工具，tools是常用工具，txt存放文本

todolist:
将函数模块化，使得不同脚本可以共用最新版的函数
使用计算机视觉或网络方法来确认新上岛的小马，并打招呼
调增流霜黯淡的提示词权重，降低越狱风险
增加书目，制作书单
制作切换角色的功能
制作批处理程序提高自动化程度




