#单独运行用于测试llama3-7b的脚本，发送hello给llama3，并打印回答。
#测试api的脚本
from gradio_client import Client

client = Client("ysharma/Chat_with_Meta_llama3_8b")
result = client.predict(
		message="Hello!!",
		request=0.95,
		param_3=512,
		api_name="/chat"
)
print(result)
