/* posts.js — 你唯一需要改的文件
   ══════════════════════════════════════════════════════════════
   加一篇新日志 = 在数组最前面加一个对象，然后刷新浏览器。

   字段说明：
     slug    网址里用的短名（英文/数字，不能重复）
     date    日期 YYYY-MM-DD
     title   标题
     tags    标签数组
     summary 列表里显示的一句话摘要
     body    正文，直接写 HTML：
               <p> <h2> <ul><li> <blockquote> <code> <strong> <a>
               <figure><video controls poster="media/xxx.jpg">
                 <source src="media/xxx.mp4" type="video/mp4" />
               </video><figcaption>说明</figcaption></figure>
   ══════════════════════════════════════════════════════════════
   下面 2 篇是按「今天实际发生过的事」写的草稿。
      事实是对的（视频、网页、游戏都是真的），
      
   ══════════════════════════════════════════════════════════════ */

const POSTS = [
  {
    slug: 'grassland-game',
    date: '2026-11-04',
    title: '第二个作品：一个能玩的跑酷小游戏',
    tags: ['作品', 'canvas'],
    summary: '没有引擎、没有贴图，角色和草地全是代码画的。现在可以直接玩了。',
    body: `
      <p>这是我第二个能跑起来的东西：一个纯网页的跑酷小游戏。不用装任何东西，点开就能玩。</p>

      <p><a class="play" href="games/grassland-run/" target="_blank" rel="noopener">▶ 点这里直接玩</a></p>

      <figure class="media">
        <a href="games/grassland-run/" target="_blank" rel="noopener">
          <img src="games/grassland-run/preview.png" alt="游戏画面：粉色团子在草地上奔跑" />
        </a>
        <figcaption>空格跳跃，空中再按一次二段跳，↓ 滑铲。按 R 能看见角色的骨架。</figcaption>
      </figure>

      <p>纸面上它是个"小游戏"，但里面有几件事是我以前完全不会的：</p>

      <ul>
        <li><strong>固定 1/120 秒的物理步长</strong>——不管电脑快慢，跳跃高度都一样</li>
        <li><strong>两骨 IK 解算腿的位置</strong>——脚是真的踩在地上，不是摆姿势</li>
        <li><strong>屏幕震动用 trauma 的平方衰减</strong>——不是每帧随机抖，那样会晕</li>
        <li><strong>弹簧关节</strong>——落地时身体压扁再弹回，所以跑起来有重量</li>
      </ul>

      <h2>做的时候踩的坑</h2>

      <p>最蠢的一个：角色跑出屏幕右边。原因是画实体的时候忘了减相机坐标——背景内部已经把世界坐标换成了屏幕坐标，实体却还在用世界坐标。查了很久，最后只是加了一行 <code>translate(-cam.x, 0)</code>。</p>

      <p>第二个：四肢全是 NaN，整个人只剩一个圆球。原因更蠢——玩家对象上少了一个 <code>speed</code> 字段，所有和速度有关的计算都变成了 NaN。</p>

      <blockquote>能定位到「哪一行」之前，都不要猜。</blockquote>

      <p>这两个 bug 都不是"不会写"，而是"不知道自己写的东西在哪里断了"。这也是我现在最想补的能力。</p>
    `
  },
  {
    slug: 'three-tools',
    date: '2026-11-04',
    title: '装了三个软件，才搞清它们各干什么',
    tags: ['工具', '环境'],
    summary: '编辑器负责写，Git 负责记录，Node 负责运行。',
    body: `
      <p>今天干了一件以前觉得"跟我没关系"的事：在自己电脑上装了三个开发用的软件。</p>

      <p>三个都放在 E 盘，都是<strong>便携版</strong>——不往 C 盘写、不改注册表、不需要管理员权限。哪天不想要了，删掉文件夹就等于卸载。</p>

      <h2>一、VS Code：写代码的地方</h2>

      <p>它不是编译器，也不是什么高级工具，就是一个<strong>文本编辑器</strong>，只是专门为写代码优化过：语法高亮、补全、内置终端。</p>

      <p>我现在改这个网站，就是在它里面打开 <code>posts.js</code>，改几行，按 <code>Ctrl + S</code>，然后推送。</p>

      <h2>二、Git：给代码装了一台时光机</h2>

      <p>Git 管的是「版本」。每改一次，它记一笔（叫 commit），写一句说明。于是：</p>

      <ul>
        <li>改坏了，能回到任何一个之前的版本</li>
        <li>能看见每一行是谁、什么时候改的</li>
        <li>能把本地记录同步到 GitHub（这一步叫 push）</li>
      </ul>

      <p>以前我改东西只有两种状态：改之前、改之后。现在每一笔都有记录。</p>

      <h2>三、Node.js：让 JavaScript 在浏览器外面也能跑</h2>

      <p>JavaScript 本来是浏览器里的语言。Node 是一个"引擎"，让同样的语言可以直接在电脑上运行。</p>

      <p>为什么写网页也要它？因为很多开发工具本身就是用 JS 写的，需要一个引擎来跑它们。</p>

      <blockquote>说句实话：这个网站根本不需要 Node。纯 HTML/CSS/JS 的文件，双击就能开。我装它，是为了以后——写构建脚本、调 AI 接口、跑本地预览服务器。</blockquote>

      <h2>踩的坑（比教程有用）</h2>

      <ul>
        <li><strong>下载慢</strong>：VS Code 的压缩包有 352 MB，下了十几分钟；Git 从 GitHub 下也花了 9 分钟。</li>
        <li><strong>SSL 证书报错</strong>：<code>git push</code> 时报证书吊销检查失败，因为这台机器连不上验证服务器。最后只给这个仓库关掉了校验。</li>
        <li><strong>PowerShell 粘多行</strong>：三行命令一次粘进去，会出现 <code>&gt;&gt;</code> 提示符，因为 PowerShell 以为命令还没写完。要一行一行粘。</li>
        <li><strong>VS Code 的"信任文件夹"</strong>：第一次打开会问信不信任这些文件，不点就一直锁在受限模式。</li>
      </ul>

      <h2>今天真正的收获</h2>

      <p>不是"装了三个软件"，而是知道了它们各自负责什么：<strong>编辑器负责写，Git 负责记录，Node 负责运行。</strong></p>

      <p>今天最烦的：我讨厌自己"什么都不知道，活就干完了"。</p>

      <p>但最爽的，偏偏也是这个。</p>
    `
  },
  {
    slug: 'i-never-studied-ai',
    date: '2026-11-04',
    title: '我其实没"学"过 AI',
    tags: ['坦白', '开始'],
    summary: '没上过课，没写过模型代码。我做的只有一件事：跟 AI 说话。',
    body: `
      <p>说实话，我不知道这算不算在学 AI。</p>

      <p>我没有看完任何一门课，也没写过一行模型代码。我做的事只有一件：<strong>跟 AI 对话，然后让它把东西做出来。</strong></p>

      <p>到今天为止，我让它做了三样东西：</p>

      <ul>
        <li>这个网页（你敢信，都是它写的）</li>
        <li>一个能跑的跑酷小游戏，角色和草地全是代码画的</li>
        <li>一支 28 秒的音乐视频，风格是 80 年代赛璐璐动画</li>
      </ul>

      <p>那这算"学"吗？我现在的答案是：<strong>算一半。</strong></p>

      <p>我会用，但说不清它为什么能做到。</p>

      <h2>所以从今天起换个方式</h2>

      <p>每做一件东西，就写一遍过程：我让它做什么、它哪里做错了、我改了什么。</p>

      <p>因为"只会要东西"和"知道怎么要到好东西"，是两件完全不同的事。</p>
    `
  },
  {
    slug: 'sakura-mv',
    date: '2026-11-04',
    title: '28 秒的 MV：一首歌变成一个动画片',
    tags: ['作品', '视频'],
    summary: '我给 AI 一首歌和一句"80 年代赛璐璐"，它先写了分镜表，再逐帧画出来。',
    body: `
      <figure class="media">
        <video controls playsinline preload="metadata" poster="media/poster.jpg">
          <source src="media/sakura-days.mp4" type="video/mp4" />
          你的浏览器不支持 video 标签，<a href="media/sakura-days.mp4">点这里直接下载</a>。
        </video>
        <figcaption>《樱花草》· 28.68 秒 · 1080p 24fps · 80 年代赛璐璐风格</figcaption>
      </figure>

      <p>我给它一首 28 秒的歌，和一句话："做成 80 年代赛璐璐动画的 MV"。</p>

      <p>它没有直接开始画。它先写了一份<strong>分镜表</strong>：7 个镜头，每个镜头写清楚景别、机位怎么动、以及<strong>为什么这样拍</strong>。</p>

      <p>我注意到两件让我意外的事。</p>

      <h2>一、切点不是"看着切"的</h2>

      <p>歌是 124 BPM，一个小节 1.935 秒。它把每次转场都对齐在小节线上——0、3.87、7.74、11.61……不是凭感觉，是算出来的。</p>

      <h2>二、它中途改了计划</h2>

      <p>原本设计的是"校园大远景"。它后来改成"特写 + 剪影 + 逆光"，理由是：程序化绘制画全身人物和远景最容易失真，改成特写反而更像那个年代的手绘质感。</p>

      <blockquote>这两件事都不是"画得好看"，而是"知道为什么这么画"。</blockquote>

      <p>而这正是我现在最想学的东西——不是让它给我结果，是看懂它做决定的那一步。</p>

      <p>（原片 1080p 有 56 MB，放网页上会卡。这个版本压到 11 MB，看上去没差多少。压缩用的是显卡硬件编码，2 秒就压完了。）</p>
    `
  }
];
