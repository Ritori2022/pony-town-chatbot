//启动浏览器用于连接
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--remote-debugging-port=9223'],
    devtools: true,
  });
  
  console.log('按下 Ctrl+C 关闭浏览器');
  process.stdin.resume();
})();