#用于在run_gpt.js和llama3-7b api之间传递消息的python脚本import sys
from gradio_client import Client

# 从命令行参数获取 message
message = sys.argv[1] if len(sys.argv) > 1 else "Hello!!"

client = Client("ysharma/Chat_with_Meta_llama3_8b")
result = client.predict(
    message=message,
    request=0.95,
    param_3=512,
    api_name="/chat"
)
print(result)