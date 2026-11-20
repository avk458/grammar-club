<a href="https://hellogithub.com/repository/ecc02353c1d7403983a8358b61c16521" target="_blank"><img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=ecc02353c1d7403983a8358b61c16521&claim_uid=0SopKcCVW3jPLQk&theme=small" alt="Featured｜HelloGitHub" /></a>

# 语法俱乐部 - [在线阅读](https://llwslc.github.io/grammar-club)

<div align="center">
  <a href="https://llwslc.github.io/grammar-club">
    <img src="docs/.vuepress/public/cover.png" alt="">
  </a>
 </div>

### 项目说明

- 看到了《语法俱乐部》电子化的[项目](https://zhusandiao.gitbook.io/grammar-club/)，与扫描版略有不同，作者加入了自己的标注，删减与本土化，也有一些错误。
- 珠玉在前，但仍希望根据扫描版完成本《语法俱乐部》电子化项目。
- 本《语法俱乐部》电子版，使用 [VuePress](https://vuepress.vuejs.org/zh/) 生成。
- 如有错误，欢迎在此提出 [issues](https://github.com/llwslc/grammar-club/issues) 。

### 作者简介

旋元佑

TIME 中文解读版《解读时代杂志》总主笔。第一名考上台大外文研究所，分数几乎是第二名的 2 倍。

旋元佑老师在台湾完成所有教育，从未出洋留学，但他对外国语文特殊的学习方法，却创下托福满分（677 分）及 GRE 字汇部分（720 分）世界纪录的惊人成就。

旋老师投入英语教学多年，深入了解中文读者学习英语的困难。为了帮助华人英文学习者学好英文，特别设计出一系列《深入浅出》、《只要理解，不要公式》的单元，如《语法俱乐部》、《时代经典用字》、《字源大挪移》、《修辞高峰会》等。在《解读时代杂志》连载，与读者分享他的学习方法及心得。

《语法俱乐部》在《解读时代杂志》连载近两年期间，不断接获读者询问集结出书时间，及要求专栏附上学习成果评讲。

旋元佑老师为了帮助读者在文法学习的路上走得更轻松更稳健，特别增添 453 组测验及详细解说，使读者可无师自通。

读者在自习过程中遇到任何疑问，旋老师非常乐意为各位解答，欢迎来信、传真、E-mail 至经典传讯，由读者服务部代为处理。

### Omarchy 主题版

本仓库是 [llwslc/grammar-club](https://github.com/llwslc/grammar-club) 的分支，改成一个在 [Omarchy](https://omarchy.org/)
桌面上使用的 Web App，由 GitHub Pages 托管：<https://avk458.github.io/grammar-club/>。

- 配色跟随当前 Omarchy 主题。页面无法读取本地主题文件，所以启动脚本 `scripts/launch.sh` 从主题的
  `colors.toml` 取出背景色、前景色、强调色和深色背景，放进 URL 打开页面。页面把配色存进
  localStorage，之后直接打开网址也能保持。
- 记住读到哪一章、哪一行。滚动位置存在 localStorage，下次从启动脚本打开时回到该章节的该位置。
- 侧栏可折叠。章节目录分组可以点击箭头收起；左下角的按钮可以整条收起侧栏，状态同样保存。

安装启动项：

```bash
./install.sh
```

脚本写入 `~/.local/bin/grammar-club` 和桌面启动项。重新发布站点用 `./deploy.sh`，它把构建结果推到
`gh-pages` 分支。主题色的正则校验在 `enhanceApp.js` 的 `paletteCSS` 中。

离线 EPUB：

```bash
npm run epub
```

生成 `dist/grammar-club.epub`。网页里的问答是 Vue 组件，靠 JavaScript 显示答案，Foliate 不执行脚本；
EPUB 里改成原生 `<details>` 元素，不用脚本，点开就能看答案。选择题的题目和四个选项一直显示，
只把答案收在“答案”一行后面；其余问答题仍以题目为标题折叠。

封面是 `assets/cover.svg` 画的，改完重新出图：

```bash
rsvg-convert -w 1600 -h 2400 assets/cover.svg -o assets/cover.png
```
