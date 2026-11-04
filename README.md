# 我的 AI 学习日志

一个纯手写的静态网站：黑白、等宽、没有框架、没有构建步骤。
双击 `index.html` 就能看。

![首页截图](shots/index-light.png)

## 文件在哪、各干什么

```
index.html   骨架：顶栏、首屏、日志容器、现在、关于。基本不用动
style.css    设计系统：颜色 / 字号 / 间距全是变量，改一处全站变
posts.js     ← 你每天只改这个
app.js       逻辑：把数据渲染成列表、单篇路由、深浅色、滚动淡入
```

## 每天怎么加一篇（30 秒）

1. 打开 `posts.js`
2. 在 `const POSTS = [` 后面，**最前面**插入一段：

```js
{
  slug: 'day-4',                       // 网址里用的名字，不能重复
  date: '2026-11-05',                  // 日期，排序靠它
  title: '今天搞懂了什么是梯度',
  tags: ['基础'],
  summary: '一句话：它就是个坡度。',
  body: `
    <p>正文第一段。</p>
    <p>正文第二段，可以写 <code>行内代码</code>，也可以加粗 <strong>重点</strong>。</p>
    <h2>小标题</h2>
    <ul><li>列表项</li></ul>
    <blockquote>想强调的一句话。</blockquote>
  `
},
```

3. 刷新浏览器，完成。

> 注意：上一篇的结尾有一个逗号 `,`，别漏掉。
> `body` 外面是反引号 `` ` ``（键盘左上角 Esc 下面那个），不是单引号。

## 改名字 / 简介 / 「现在」

- 名字：全局搜索 `老登不洗脸`，一共 5 处
  （`index.html` 的 `<title>`、`og:title`、顶栏、页脚，以及 `app.js` 里那行动态标题）
- 首屏那句话：`<h1>我在这里学 AI。</h1>`
- 「现在」的三条：`index.html` 里 `<ul class="now-list">` 整个区块
- 邮箱：`<a href="mailto:3432393139@qq.com">`

## 你已经学到的三个概念

1. **内容和代码分开。** 文案在 `posts.js`，排版在 `style.css`，渲染在 `app.js`。
   所以加日志不用碰 HTML，改配色不用碰内容。这是所有正经项目的做法。

2. **设计系统 = 变量。** `--space-4: 16px` 这种写法，让"间距"变成一个决定，
   而不是每处随手写个 `margin: 17px`。以后想整体调紧，只改一个数。

3. **用 `#` 做路由。** 网址里 `#/p/grassland-game` 这段不会被发给服务器，
   所以纯静态页面也能有"每篇一个链接"，不需要后台。
   这也是为什么它能直接双击打开。

## 下一步：让它上线

本地文件只有你能看。放到 GitHub Pages 上，会得到一个
`https://你的用户名.github.io/` 的真实网址——那才是能写进简历的东西。

步骤见下面「发布到 GitHub Pages」。

## 发布到 GitHub Pages（不用装 Git）

1. 打开 github.com → 右上角 `+` → **New repository**
2. 仓库名填 `你的用户名.github.io`（例如用户名叫 `lin`,就填 `lin.github.io`）
   可见性选 **Public**（免费账号只能从公开仓库发布网页）
3. 创建后，在空仓库页面点 **uploading an existing file**
4. 把 `index.html` `style.css` `app.js` `posts.js` `favicon.svg` `README.md`
   和 `shots` 文件夹一起拖进去 → **Commit changes**
5. 仓库 → **Settings** → 左侧 **Pages**
   → Source 选 **Deploy from a branch**
   → Branch 选 **main**、目录选 **/(root)** → **Save**
6. 等 1–2 分钟，访问 `https://你的用户名.github.io/`

以后更新内容：回到仓库 → 点 `posts.js` → 右上角铅笔图标 → 改 → Commit。
（或者装 Git，之后用 `git push`，那是下一课。）

> 国内直连 github.io 有时会慢或打不开。先用着，需要的话后面可以换
> Cloudflare Pages 或绑自己的域名。

## 已知的小坑

- `IntersectionObserver` 的回调如果晚一拍，区块会一直是 `opacity: 0`。
  所以 `app.js` 里对首屏元素做了同步显示，只有屏幕外的才等滚动。
- `body` 里写的是 HTML 字符串，所以 `posts.js` 不是"纯文本"，
  以后想换成 Markdown，需要加一个解析库（或用构建工具）。
