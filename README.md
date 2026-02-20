# NJU Captcha 油猴脚本

一个极度轻量的南京大学统一身份认证验证码自动识别填充脚本。

## Feature
- Lightweight (the model pth is less than 0.1MB, much smaller tham [ddddocr](https://github.com/86maid/ddddocr) or [Do1e](https://github.com/Do1e/NJUcaptcha))
- Fast (Fewer params and computations)
- All in one file(the model is converted to string using `base64`, the only requrement is wasm runtime of onnx)
> Connection to `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js` is requirement is needed at the first time load the scripts.

## Installation

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

## Usage

安装后访问南大统一身份认证页面，脚本会自动：
1. 加载 ONNX 模型（首次加载可能需要几秒）
2. 识别验证码图片
3. 自动填充到验证码输入框

点击验证码图片刷新后，脚本会自动重新识别。

## Reference

- 油猴脚本参考：[lyc8503/ddddocr_web](https://github.com/lyc8503/ddddocr_web/blob/master/captcha.user.js)
- 模型训练参考：[Do1e/NJUcaptcha](https://github.com/Do1e/NJUcaptcha)
> Tips: 26年初验证码的风格发生了变化，Do1e的数据集也许已经过时！

## Training&Dataset

Authserver caption was updated in the Feburary 2026, thus creating a data distribution shift, which made the old model failed to recgonize the text. (Due to the overfitting of my model)
<img width="1100" height="637" alt="4fa2b3e409c56d7f447e393f0282850a" src="https://github.com/user-attachments/assets/54a1949c-442e-4e84-a5da-460a5ec80366" />

So new datasets are collected using `crawl/crawl.py` to crawl new version of captcha.(To put simply, `https://authserver.nju.edu.cn/authserver/getCaptcha.htl?{a random number}` returns a random captcha img)

Lmdb is used to accelarate the speed of data transfortation to avoid IO overdurance caused by creating/deleting numerous small files at one time.

You can download colected imgs here: 
- [NJU Auth Captcha Dataset(no annotations available)](https://box.nju.edu.cn/d/89b2fd03b5e646b493da/) . 
- [NJU Class Selection Dataset(no annotations available)](https://box.nju.edu.cn/f/f53d445cd8434c798083/)


It's worth mentioning that the Auth dataset is for http://authserver.nju.edu.cn, the official auth website of NJU with lmdb format. While Class Selection Dataset if for http://xk.nju.edu.cn with raw imgs.
Both the datasets are not annotated(you may annotate them using `ddddocr` and `yolo` maybe).

