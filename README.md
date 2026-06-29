# Bilibili Obsidian Clipper Plus｜一键保存B站字幕增强版

[![GitHub all releases downloads](https://img.shields.io/github/downloads/youpingfang/Bilibili-Obsidian-Clipper-Plus/total?style=flat-square&logo=github&label=downloads)](https://github.com/youpingfang/Bilibili-Obsidian-Clipper-Plus/releases)
[![Chrome Web Store users](https://img.shields.io/chrome-web-store/users/jokophbofiphenlplmohabdcmalcbenl?style=flat-square&logo=google-chrome&logoColor=white&label=chrome)](https://chromewebstore.google.com/detail/jokophbofiphenlplmohabdcmalcbenl)
[![GitHub release](https://img.shields.io/github/v/release/youpingfang/Bilibili-Obsidian-Clipper-Plus?style=flat-square&label=version)](https://github.com/youpingfang/Bilibili-Obsidian-Clipper-Plus/releases)


Bilibili Obsidian Clipper Plus 是一个面向 Obsidian 的浏览器剪藏增强版：既可以在 B 站视频页抓取字幕、生成 AI 总结并保存到 Obsidian，也可以在普通网页中读取正文内容，整理成 Markdown 后复制、下载或写入 Obsidian。

> 注意：仅支持获取“有字幕轨”的 B 站视频字幕；没有字幕轨、字幕被限制或页面暂未加载出字幕信息的视频无法获取字幕。

## Plus 增强内容

这个版本在原有“抓取 B 站字幕并保存到 Obsidian”的基础上，加入了网页剪藏、AI 总结和更稳定的页面内弹窗体验：

- 支持 B 站视频页字幕抓取，自动识别当前视频和分 P。
- 支持普通网页正文读取，可把文章、教程、博客等网页内容整理成 Markdown。
- 支持将 B 站字幕或网页正文交给 AI 生成总结。
- 弹窗改为页面内显示：点击扩展图标后，窗口会出现在当前页面右上角。
- 切换到其他标签页时，弹窗不会自动消失，已抓取的字幕、网页内容和 AI 总结会保留。
- 弹窗采用左右双栏：左边是原始内容，右边是 AI 总结。
- 底部的 `复制 / 下载 / 阅读 / 保存到 Obsidian` 会根据当前选择的栏目执行：可处理原文，也可处理 AI 总结。
- 设置页支持配置 DeepSeek / OpenAI-compatible API、模型和常用提示词。
- AI API Key 只保存在浏览器本机，其他普通配置会同步到浏览器账号。

## 功能

- B 站字幕抓取：在视频页读取字幕轨，预览后复制、下载或保存到 Obsidian。
- 网页正文剪藏：在普通网页中提取标题、正文和页面链接，生成适合 Obsidian 的 Markdown。
- AI 总结：支持对字幕或网页正文进行总结，并可继续复制、下载、阅读或保存。
- Obsidian 写入：通过 Local REST API 一键保存到指定笔记目录。
- 阅读视图：把字幕、网页正文或 AI 总结切换成更适合长文阅读的沉浸式布局。
- 页面内弹窗：支持拖动、整体缩放，切换标签页后内容不丢失。

### 阅读视图（v1.0.18+）

沉浸式布局，支持排版调整、主题切换、字幕同步等。

> 稍后再看页面的阅读视图体验尚不完善，推荐在普通视频页使用。

## 功能图片演示

![Bilibili Obsidian Clipper Plus 功能演示](docs/images/feature-demo-v2.png)

## 安装方式

### 从当前源码加载到 Chrome / Edge

如果你是从 GitHub clone 或下载本项目源码，请注意：浏览器要加载的是项目里面的 `extension/` 目录，不是项目根目录。

> 也就是说，选择文件夹时请选 `Bilibili-Obsidian-Clipper-Plus/extension`。如果选了外层的 `Bilibili-Obsidian-Clipper-Plus`，浏览器会提示清单文件缺失或加载失败。

1. 打开扩展管理页：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择这个目录：

   ```text
   Bilibili-Obsidian-Clipper-Plus/extension
   ```

5. 不要选择项目根目录 `Bilibili-Obsidian-Clipper-Plus`，否则会出现“清单文件缺失或不可读取 / 无法加载清单”的错误。
6. 修改代码后，回到扩展管理页点击该扩展的“重新加载”按钮，再刷新 B 站视频页面。

### Chrome / Edge

1. 在 GitHub 的 `Releases` 页面下载最新的 `*-chrome.zip` 包
2. 解压到任意本地目录
3. 打开扩展管理页：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的扩展目录

### Firefox

1. 在 GitHub 的 `Releases` 页面下载最新的 `*-firefox.zip` 包
2. 解压到任意本地目录
3. 打开 Firefox 附加组件管理页：`about:addons`
4. 点击右上角齿轮图标 → "调试附加组件"
5. 点击"临时加载附加组件..."
6. 选择解压后的文件夹中的 `manifest.json` 文件

## 项目结构

- `README.md` / `LICENSE`：项目说明与许可证
- `extension/`：插件源码（manifest、js、css、icons）

## Obsidian 配置

1. 在 Obsidian 社区插件市场安装并启用 `Local REST API with MCP`
2. 在插件设置中勾选 `Enable Non-encrypted (HTTP) Server`
3. 复制插件页面里的 API Key
4. 在扩展设置页填写 `Local REST API 地址`、`API Key`、`笔记目录`

## AI 总结配置

1. 打开扩展设置页。
2. 在 `AI 总结` 区域勾选“启用 AI 总结”。
3. 填写 AI API 地址，例如：

   ```text
   https://api.deepseek.com
   ```

4. 填写 AI API Key。
5. 点击“获取模型”，从下拉框选择要使用的模型。
6. 在“常用提示词”中维护一个或多个提示词，并选择默认提示词。
7. 点击“保存设置”。

只要服务兼容 OpenAI Chat Completions 格式，理论上都可以通过自定义 API 地址接入。

## 使用方式

### B 站字幕保存

1. 打开任意 B 站视频页，点击浏览器工具栏里的扩展图标。
2. 弹窗会出现在当前页面右上角，并自动抓取字幕。
3. 左侧查看原始字幕，右侧点击 `总结` 生成 AI 总结。
4. 点击左侧字幕栏时，底部按钮会处理原字幕；点击右侧 AI 总结栏时，底部按钮会处理 AI 总结。
5. 可直接 `复制`、`下载`、进入 `阅读` 视图，或点击 `保存到 Obsidian` 写入笔记。

### 网页正文剪藏

1. 打开普通网页、文章页、教程页或博客页面，点击浏览器工具栏里的扩展图标。
2. 插件会尝试读取当前网页标题、正文和链接，并整理成 Markdown。
3. 如果页面结构复杂，可以在弹窗里检查内容后再复制、下载或保存。
4. 点击 `总结` 可以让 AI 对网页正文生成摘要，再把摘要保存到 Obsidian。

### 弹窗操作

- 按住弹窗顶部可以拖动位置。
- 拖动弹窗四周或四个角可以整体放大或缩小。
- 切换到其他标签页时弹窗内容不会丢，回到原页面还能继续使用。
- 点击页面空白区域会关闭弹窗；点击 `保存到 Obsidian` 成功后也会自动关闭。

## 视频教程

- [B 站教程](https://www.bilibili.com/video/BV15qQwB4EZ9/?spm_id_from=333.1387.homepage.video_card.click&vd_source=040bc5ea7866b419558ec2682a2ccb59)

## 免责声明

> ▎ **用户自负责任条款**：本工具仅在用户已登录 B 站、且有访问权限的前提下获取数据。所有数据通过用户自己的浏览器和 cookie 获取，不经过任何第三方服务器。本工具不存储、不分发任何 B 站内容。使用本工具产生的所有后果由用户自行承担。请遵守 B 站用户协议与相关法律法规。
