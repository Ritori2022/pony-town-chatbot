pony-town-chatbot 小马镇聊天机器人

用于在小马镇自动获取聊天记录并且回复的机器人

可以朗读书籍，对话，玩角色扮演游戏

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

min_test.js//自动化运行的最小可行自动测试

pt_game.js//用于单人桌面角色扮演的脚本，接受玩家聊天输入，数字选择主题，字母选择选项

rejoin.js//用于自动重连的脚本，每20秒查找一次safe chinese按钮，找到就点

run_gpt.js//用来通过python获得llama3-7b回复的脚本

screenshot.js//每5分钟自动截图一次的脚本

sned_message.js//发送一次聊天内容到pt的脚本

test.py#单独运行用于测试llama3-7b的脚本，发送hello给llama3，并打印回答。

test1.js//连接到browser.js的测试，使用browser.js开启的测试浏览器继续进行自动化操作

welcome.js//用于发送欢迎语的脚本，从oc.txt中读取，有人发言就发送欢迎语，每分钟最多发一次，通过按键5和6控制小马的睡眠和唤醒





