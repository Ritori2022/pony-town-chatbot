//用来通过python获得llama3-7b回复的脚本
//传消息给python
const { exec } = require('child_process');

// 要传递给 Python 脚本的 message 参数
const message = "Hello!";

// 执行 Python 脚本并传递参数
exec(`python3 gpt.py "${message}"`, (error, stdout, stderr) => {
  if (error) {
    console.error(`执行出错: ${error}`);
    return;
  }
  console.log(`Python 脚本输出:\n${stdout}`);
});