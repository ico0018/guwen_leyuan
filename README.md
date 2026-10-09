# 古文乐园

面向小学生的静态古诗学习工具。小学 1～6 年级课内目录的 **116 个位置全部有正文，对应 114 部不同作品**；另保留 3 篇补充内容，包括《赠刘景文》《司马光》和原来的语文园地内容。新增三年级日积月累 3 篇（教材第 44、56、108 页，共 10 条名句），单独展示在三年级书架的“日积月累”栏目。共 120 份 TXT，其中 115 份为诗词（105 首古诗、10 首词；曲 0）。保留汉字点击、自动拼音、Hanzi Writer 笔顺动画、描红、空白田字格、笔顺检测、选字排序、全文默写和本地学习记录。

## 运行

无需前端构建、API Key 或后端：

```bash
python scripts/scan_content.py
python -m http.server 4173
```

打开 http://localhost:4173 。部署时上传根目录 HTML、CSS、JS（包括 `speech.js`、`dictation.js` 和 `dictation.css`）及完整 `content/`；有录音时也上传 `audio/`。

## 内容的维护入口

- `content/curriculum.json`：年级、册次、顺序、作者、作品 `workId`、课内位置 `placementId`。顺序和 116 个位置保持原目录。
- `content/gradeN/lessonN.txt`：唯一正文入口，维护原文、译文、逐行解释、重点字词、知识点及音频。
- `content/manifest.json`：扫描生成的结果，不手工修改。

《鹿柴》（三、四年级）、《江上渔者》（二、六年级）各复用一份 TXT。两首杜甫《绝句》分别使用 `dufu-jueju-huangli` 和 `dufu-jueju-chiri`；王翰和王之涣的《凉州词》也使用不同身份。原有课内 URL、位置 ID 和学习记录键保持不变；旧 `gradeN-lessonN` 链接可通过来源 ID 找到对应课内内容。

每册课内数量：一年级 6/7，二年级 7/7，三年级 10/9，四年级 10/10，五年级 11/11，六年级 11/17（上册/下册）。114 是目录实际去重结果，不能为了目录图的“115 首”删减或增加位置。

## 新增或修改课程

新增课程时在目录中配置一个稳定、不随标题修改的 `workId`；在 TXT 写相同的作品 ID。同一作品的多个课内位置复用这份 TXT；同名但不同作品使用不同 ID，必要时继续配置 `distinguishing` 首句。文件名为 `content/gradeN/lessonN.txt`，选择尚未使用的编号。

```text
标题：
咏鹅
作者：
[唐] 骆宾王
朝代：
唐
出处：
一年级上册
类型：
古诗
作品ID：
与 curriculum 对应的 workId
原文：
鹅，鹅，鹅，
曲项向天歌。
白毛浮绿水，
红掌拨清波。
译文：
白鹅弯着脖子向天歌唱，白羽浮在绿水上，红掌拨动清波。
逐句译文：
白鹅啊，白鹅啊，白鹅。
弯曲着脖子朝着天空歌唱。
洁白的羽毛漂浮在碧绿的水面上。
红色的脚掌拨动着清清的水波。
知识点：
1. 曲项：弯曲脖子。
2. 拨：划动水波。
汉字：
曲：qū｜弯曲。
项：xiàng｜脖子。
拨：bō｜划动。
```

`古诗/诗/词/曲` 的原文非空行直接成为学习行；原文已经有多行时，即使未写类型也优先保留换行。只有单段古文或故事才按标点和长度自动分段。逐句译文与原文行一一对应，数量不符会输出带文件路径的 warning，继续扫描其他内容。课本节选保留节选：《古朗月行》4 行、《赋得古原草送别》4 行、《采薇》末章 8 行；六年级《长歌行》采用含“青青园中葵”的十个诗行，不加入其他同名作品。词的学习行也由 TXT 明确维护，不能在运行时按句号合并。

每行生成一组选字排序题，较长诗词覆盖全部行。全文默写读取 `lesson.lines`，逐字检查笔顺，完成页按原始行展示。原文修正时，默写会依据内容签名开始新练习，避免沿用旧的错误字位；阅读和汉字学习记录仍保留。

可继续使用 Markdown 标题、UTF-8 BOM 和 CRLF；`小练习` 区块仍支持原来的故事排序、选择题，重点字词未填写的汉字继续使用自动拼音。

## 朗读

只有配置录音路径时才请求录音。可选字段：

```text
朗读音频：
audio/poems/grade1/yong-e.mp3
汉字：
鹅：é｜白鹅｜audio/characters/e.mp3
```

没有路径时立即用系统中文 TTS。录音 `play()` Promise 失败、播放中出错或加载超过 1.8 秒时自动回退；不会猜测远程文件。优先选择 zh-CN，其次其他中文声音，支持异步 `voiceschanged`，语速 0.8，保留原文标点和换行。再次点击、换课、换字或关闭弹窗会停止旧朗读；迟到的回调不会重新播放。系统不支持时明确提示。系统音色和中文语音是否安装取决于设备。

## 测试

```bash
python scripts/scan_content.py
python -m unittest discover -s tests -v
node --test tests/dictation.test.cjs
node --test tests/speech.test.cjs tests/curriculum.test.cjs
```

覆盖全部目录位置、作者与作品映射、TXT 原始诗行、全部逐行译文、全部排序题、节选范围、同名作品和重复作品，以及录音成功/失败、直接 TTS、异步中文声音、停止旧音频、取消迟到的回调、设备不支持等行为。原有书写和默写功能测试继续保留。
## 统一账号与云同步（开发分支）

网站仍是独立静态站，游客继续使用旧 localStorage。请一起部署 `cloud-config.js`、`cloud-sync.js`、`cloud-ui.js`、`cloud-ui.css`。公开配置 `apiBase` 默认 `https://api.xuebabangbang.cn`，`portalBase` 默认 `https://xuebabangbang.cn`；隔离腾讯预览可指向同一预览 origin，`apiBase: ''` 表示同源。地址末尾不要加 `/`。所有 API 请求带 `credentials: include`，服务端负责 Session、CORS 和 Origin 校验；前端无认证 Token。

云记录以 `guwen-leyuan-learning-v2`、`guwen-leyuan-read-v1` 与 `guwen-dictation-handwriting-v1:<lessonId>` 原值组成 schemaVersion 1 的 key→JSON字符串 payload。课文、目录、录音等静态资源不进入用户数据库，原阅读、练习、默写规则保留。

登录不会自动迁移游客记录。需在古文原域名下选孩子并确认“导入本机游客记录”；旧游客记录不删除。本机缓存按 `xbb:state:v1:guwen:<userId>:<profileId>` 隔离，切孩子重载。离线 dirty/generation 持久保存，断网重试和回到工具时检查当前 Session。同步失败显示失败，revision 409 停写并展示本机/云端选择和包含两份候选及游客数据的导出；确认选择时另存恢复副本，不静默丢弃冲突。账号中心还可导出云端所有工具记录。

运行 `node scripts/test-cloud-sync.cjs` 验证11项云同步场景；原有 `node --test tests/*.test.cjs` 和 `python -m unittest discover -s tests` 保留。静态站无 lint/typecheck/build 配置。


## 家长页面与简洁学习页面

`parent.html` 是本工具同origin的家长入口，包含账号中心、孩子切换、同步状态、游客记录导入、备份、冲突选择与恢复。学生页不显示家长入口或记录管理控件，后台仍自动同步，不向孩子展示存储和同步操作。

家长回答一道中文数字计算题、从三个数字中选择正确结果即可进入。账号模式由服务器签发与校验题目，读取统一Session的 `parentReady`；当前登录持续有效，不再输入密码/PIN，也没有15分钟自动锁定。已在账号中心或另一工具进入家长模式后直接继承当前Session。主动“退出家长模式”调用服务端 parent-lock，或退出登录后才失效。游客仅作本机误点确认，以sessionStorage保存当前标签页状态，刷新可继续，主动退出清除；这不替代真正的账号认证。旧游客学习数据和遗留设置不会被删除。

运行 `node scripts/test-parent-ui.cjs`：学生无记录控件、三选一正确/错误答案、已授权Session免重复题目、显式退出、游客刷新保持；原有云同步回归新增服务端Session授权撤销，共11项。家长页题目或请求失败时可换题重试。


统一记录管理在任务小帮手 `/parent/` 中直接显示本工具 `parent.html?embedded=1` 的控件，面板仍在本工具自己的origin读取localStorage。嵌入模式隐藏重复标题、返回学习、切孩子与单独退出，只显示当前孩子和实际导入/备份/同步/冲突按钮；切孩子由中央页面统一重载。嵌入导入和冲突选择使用明确的内嵌确认/取消，点击前不执行数据操作。

`cloud-config.js` 的公开 `parentBase` 默认 `https://taskhelper.xuebabangbang.cn`，隔离预览配置为 `http://localhost:8323`。只接受真实嵌入页面、这个精确origin且source为直接父窗口的type-only游客激活/退出消息；游客授权仅保存在当前widget内存，登录会话仍必须拥有服务器parentReady，绝不通过消息授予登录权限或导入记录。消息不传送学习内容、账号/孩子ID或URL，出站仅ready或整数高度。独立parent.html仍可直接访问。定向家长UI测试现在8项，含错误来源、额外字段、初始化竞态与内嵌确认。
