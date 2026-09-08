# 读音资源说明

汉字弹窗的读音按以下顺序尝试：

1. TXT `汉字：` 行第三段配置的本地录音，例如 `光：guāng｜光亮｜audio/guang.mp3`。
2. [audio-cmn](https://github.com/hugolpz/audio-cmn) 中的普通话真人录音。
3. 当前设备提供的中文语音朗读。

项目使用的远程真人录音地址格式为：

`https://raw.githubusercontent.com/hugolpz/audio-cmn/master/64k/hsk/cmn-{文字}.mp3`

如果要使用自己录制的声音，把音频文件放入项目目录，并在对应 TXT 的 `汉字：` 区块填写相对路径即可。部署时请同时上传音频文件，并确认拥有录音的使用授权。
