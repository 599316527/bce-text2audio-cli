BCE Text2Audio Cli
============

懒得看文字，但 macOS 的 speech 语音质量太差，所以封装了一个百度开放云的语音合成接口的工具，可以把一大段文字转成音频。

去 [BCE控制台](https://console.bce.baidu.com/ai/#/ai/speech/overview/index) 创建一个应用（免费语音合成额度每天20万次，自己使用足够了）。复制 `config.sample.json` 成 `config.json`，把申请的 key 填进去。

因为接口单次调用有文本长度的限制，所以切割了一下文本，多次调用得到很多个 mp3 文件，保存在 `/tmp/` 下。因为在 js 里做 mp3 合并有点麻烦，所以运行 `node main.js < article.txt` 会得到一个 [FFmpeg](https://www.ffmpeg.org/) 的命令，复制一下跑这个命令让 ffmpeg 帮忙做合并的工作啦。

支持参数：

* `--concurrency=2` 接口并发请求个数

命令还支持语音合成接口的几个参数：

参数 | 类型 | 描述 | 是否必须
-----|----|----|----------
spd | String | 语速，取值0-9   | 否
pit | String | 音调，取值0-9   | 否
vol | String | 音量，取值0-15  | 否
per | String | 发音人选择, 0为女声，1为男声，3为情感合成-度逍遥，4为情感合成-度丫丫  | 否


