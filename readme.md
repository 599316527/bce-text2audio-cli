BCE Text2Audio Cli
============

懒得看文字，但 macOS 的 speech 语音质量太差，所以封装了一个百度开放云的语音合成接口的工具，可以把一大段文字转成音频。

```bash
npm install -g bce-text2audio-cli
bce-text2audio-cli < article.txt
```

去 [BCE控制台](https://console.bce.baidu.com/ai/#/ai/speech/overview/index) 创建一个应用（免费语音合成额度每天20万次，自己使用足够了）。然后新建 `~/.bce-text2audio-cli-config.json`，填入：

```json
{
    "APP_ID": "________",
    "API_KEY": "______________",
    "SECRET_KEY": "_______________"
}
```

因为接口单次调用有文本长度的限制，所以切割了一下文本，多次调用得到很多个 mp3 文件，保存在 `/tmp/` 下。因为在 js 里做 mp3 合并有点麻烦，所以运行后输出一个 [FFmpeg](https://www.ffmpeg.org/) 的命令，复制一下跑这个命令让 ffmpeg 帮忙做合并的工作啦。

支持参数：

* `--concurrency=2` 接口并发请求个数
* `--input-file` 指定文本文件。或者从标准流输入
* `--clean [--dryrun]` 删除临时文件

命令还支持语音合成接口的几个参数：

参数 | 类型 | 描述 | 是否必须
-----|----|----|----------
spd | String | 语速，取值0-9   | 否
pit | String | 音调，取值0-9   | 否
vol | String | 音量，取值0-15  | 否
per | String | 发音人选择, 0为女声，1为男声，3为情感合成-度逍遥，4为情感合成-度丫丫  | 否

--------

macOS 用户可以使用 Automator 新建一个 Service，接收文本，添加一个 "Run Shell Script" 模块，贴入代码：

```bash
bce-text2audio-cli --spd 5 --vol 9 < /dev/stdin | tail -n2 | head -n1 | grep ffmpeg | cut -d'|' -f 2 | awk '{$1=$1};1' | cut -d' ' -f 1-9 | awk "{print \$0 \" ~/Downloads/`date +%s`.mp3\"}" | bash -
```

这样在系统里选中文字，右键菜单里启动这个服务就能把选中的文本变成音频。
