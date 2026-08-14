# james快跑 · Instagram 公开内容预览 MVP

这是一个适合 **Mac + Codex + VS Code 初学者**的可运行 Web MVP。用户粘贴 Instagram 分享链接，后端验证链接并通过已配置的数据源返回公开内容的预览；当数据源确实给出公开媒体文件时，页面也会显示下载按钮。

本项目是免费、无账户、无解析次数限制的开源版本。实际可用性仍受 Instagram 公开页面、临时媒体链接和平台限流影响。

建议正式域名：`jameskuaipao.com`。域名可用性会实时变化，需要由经营者在注册商处购买并完成实名认证。

> 重要：本项目不是“万能 Instagram 下载器”。它不绕过登录、私密账号、访问控制、DRM 或平台限制，也不承诺取得“原画质”。请只处理你本人拥有、获作者授权或法律允许保存的内容。

## 目录

```text
.
├── public/                 # Web 页面
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── server.js           # 启动入口、读取 .env
│   ├── app.js              # HTTP 路由、静态文件、受控下载代理
│   ├── providers.js        # 官方 oEmbed 与可选公开元数据适配器
│   ├── url-policy.js       # 链接与 CDN 安全校验
│   └── config.js
├── test/                   # Node 自带测试
├── docs/
│   └── wechat-mini-program.md
├── .env.example
└── package.json
```

## 5 分钟启动

### 1. 准备环境

在 Mac 安装：

- [Node.js](https://nodejs.org/) 20 或更高版本
- [VS Code](https://code.visualstudio.com/)

在 VS Code 中打开本文件所在文件夹，再打开“终端 → 新建终端”。

### 2. 创建本地配置

```bash
cp .env.example .env
```

第一次只想看页面，可以直接启动；解析接口会提示尚未配置数据源。

推荐到 Meta for Developers 创建应用并申请 Instagram oEmbed 所需访问权限，然后在 `.env` 填写：

```dotenv
META_ACCESS_TOKEN=你的访问令牌
META_GRAPH_VERSION=v24.0
```

Graph API 版本会更新；请以 Meta 控制台和官方文档当前支持的版本为准。不要提交 `.env`，它已经被 `.gitignore` 排除。

### 3. 启动

此项目没有第三方 npm 依赖，无需 `npm install`：

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。停止服务时在终端按 `Control + C`。

### 4. 测试

```bash
npm test
```

## 数据源策略

### A. 官方 Instagram oEmbed（默认、推荐）

当 `META_ACCESS_TOKEN` 存在时，后端调用 Meta Graph API 的 `instagram_oembed`。它适合展示官方预览、标题、作者及缩略图；它通常**不是原始媒体下载 API**，所以可能只有预览而没有下载按钮。

生产上线前请确认：

1. Meta 应用类型、App Review 和权限符合当前官方要求；
2. Access Token 只保存在后端，不放进 Web 或小程序代码；
3. 按 Meta 当前文档处理版本升级、限流、数据删除和展示规范。

官方入口：[Instagram Platform 文档](https://developers.facebook.com/docs/instagram-platform/) · [Instagram oEmbed 文档](https://developers.facebook.com/docs/instagram-platform/oembed/)

### B. 公开页面元数据（可选、实验性）

如需本地验证有限的下载链路，可以在 `.env` 显式开启：

```dotenv
ENABLE_PUBLIC_METADATA_FALLBACK=true
```

这个适配器只请求用户提供的、已校验的公开 Instagram 帖子 URL，并读取页面公开的 Open Graph 元数据。它：

- 不发送账号 Cookie，不登录，不处理私密账号；
- 不解密、不模拟 App、不绕过验证码、速率限制或访问控制；
- 只接受 `cdninstagram.com` 和 `fbcdn.net` 的 HTTPS 媒体地址；
- 可能因登录墙、地区、页面结构或平台策略变化而随时失败；
- 可能与 Instagram/Meta 条款、自动化访问规则、作者版权及应用商店审核要求发生冲突。

因此不建议未经法律与平台政策评估直接用于商业生产环境。即便技术上能访问，用户也不自动获得复制、再发布或商业使用权。Meta 条款禁止某些未经许可的自动化数据收集；上线前应阅读当前的 [Meta 服务条款](https://www.facebook.com/terms.php) 和开发者政策，并取得适当授权。

## API 契约

Web 与未来微信小程序共同使用同一接口：

```http
POST /api/v1/resolve
Content-Type: application/json

{"url":"https://www.instagram.com/reel/SHORTCODE/"}
```

成功响应示例：

```json
{
  "ok": true,
  "sourceUrl": "https://www.instagram.com/reel/SHORTCODE/",
  "result": {
    "provider": "instagram-oembed",
    "title": "Instagram 公开内容",
    "authorName": "creator",
    "authorUrl": "https://www.instagram.com/creator/",
    "thumbnailUrl": "https://...",
    "media": [],
    "embedHtml": "...",
    "note": "官方 oEmbed 返回预览信息，不保证提供原始媒体文件下载地址。"
  }
}
```

错误响应始终为：

```json
{"ok":false,"error":{"code":"INVALID_URL","message":"可展示给用户的信息"}}
```

其他接口：

- `GET /api/v1/health`：健康检查，不泄露令牌；
- `GET /api/v1/download?...`：仅供解析结果使用的受控 CDN 代理，不是开放代理。

## 微信小程序迁移

接口层已与页面分离。部署后端到 HTTPS 域名后，小程序只需把 Web 中的 `fetch` 替换成 `wx.request`，并使用相同的 JSON 数据结构。完整步骤和示例见 [微信小程序迁移说明](docs/wechat-mini-program.md)。

## 上线前检查清单

- 使用 HTTPS，并在 Meta 与微信后台登记真实域名；
- 将 Access Token 放在托管平台的加密环境变量中；
- 加入速率限制、日志脱敏、监控、超时和 CDN 流量上限；
- 下载接口改为短时签名 URL，避免被外站盗用；
- 增加隐私政策、版权投诉/删除渠道和用户协议；
- 明确不支持私密内容，并对版权确认留下必要记录；
- 重新核对 Meta 条款、开发者政策、微信审核规则和当地法律；
- 若没有清晰授权，关闭 `ENABLE_PUBLIC_METADATA_FALLBACK`。

## 常见问题

**为什么配置了官方 API 仍没有下载按钮？**  
oEmbed 的目的主要是嵌入和预览，不等同于媒体下载授权。项目不会从页面脚本或隐藏接口中挖取文件。

**为什么某个公开链接也失败？**  
“在你的浏览器可见”不代表服务端无需登录即可访问。地区、年龄限制、登录墙、API 权限和限流都可能影响结果。

**能否支持轮播帖全部图片？**  
只有当获授权的官方 API 明确返回这些媒体时才应加入。当前公开页面元数据通常只暴露一个代表性预览，MVP 不猜测隐藏资源。
