# nju-captcha-extension

一个极度轻量的验证码识别插件

>   **感谢：**[Do1e/NJUcaptcha: 南大统一身份认证验证码（数据集、识别模型、识别服务）](https://github.com/Do1e/NJUcaptcha)提供数据集和思路
>
>   Claude4.5 Opus提供代码😋
>
>   我提供时间和精力来debug（🤣

![屏幕录制 2025-12-03 170107](demo.gif)

南京大学统一身份认证验证码自动识别填充插件。

## 特性

1.   超轻量模型，响应速度极快
2.   本地推理
3.   纯vibe coding，无技术含量
4.   在单卡1080Ti(11GB)上训练了5min

## 安装方法

### Chrome / Edge

0.   把extension.zip下载好，然后解压缩

1. 打开浏览器，访问 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `extension` 文件夹

## 使用方法

1. 安装插件后，访问 [南大统一身份认证](https://authserver.nju.edu.cn/authserver/login)
2. 验证码将自动识别并填充到输入框
