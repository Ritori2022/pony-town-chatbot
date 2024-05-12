# pony-town-chatbot
用于在小马镇自动获取聊天记录并且回复的机器人

javascript小白第一次在github写东西

主要功能：
运行brower.js开启测试浏览器
之后需要手动登陆pt，打开浏览记录
运行auto_pt.js开始聊天机器人自动回复消息
使用gpt.py设置api，现在用的llama3-7b，一个hugging face的api

次要功能：
运行get_talk_60s.js可以自动捕获聊天记录生成csv文件
运行afk.js可以每分钟点击一次数字0防止掉线
