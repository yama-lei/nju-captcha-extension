# NJU Captcha 油猴脚本

一个极度轻量的南京大学统一身份认证验证码自动识别填充脚本。
更新支持新的统一身份认证平台。

## 特性

- 🚀 超轻量模型（量化后仅 140KB），响应速度极快
- 🔒 本地 ONNX 推理，无需后端服务器
- 🔄 自动识别并填充验证码，支持刷新后重新识别
- 💻 纯 Vibe Coding，在 1660Ti (6GB) 上训练了 3 小时，与[Do1e/NJUlogin](https://github.com/Do1e/NJUlogin)项目使用同一个模型。

## 安装

### 1. 安装 Tampermonkey

在浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展：
- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

**如果是第一次使用油猴脚本，请在油猴脚本的设置中给足权限，否则可能无法使用**


### 2. 安装脚本

点击下方链接直接安装脚本：

**[点击安装 nju_captcha.user.js](https://raw.githubusercontent.com/yama-lei/nju-captcha-extension/main/nju_captcha.user.js)**

或者手动复制 `nju_captcha.user.js` 内容到 Tampermonkey 新建脚本中。

## 使用

安装后访问南大统一身份认证页面，脚本会自动：
1. 加载 ONNX 模型（首次加载可能需要几秒）
2. 识别验证码图片
3. 自动填充到验证码输入框

点击验证码图片刷新后，脚本会自动重新识别。

## 参考

- 油猴脚本参考：[lyc8503/ddddocr_web](https://github.com/lyc8503/ddddocr_web/blob/master/captcha.user.js)
- 模型训练参考：[Do1e/NJUcaptcha](https://github.com/Do1e/NJUcaptcha)
