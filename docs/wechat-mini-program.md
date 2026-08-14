# 微信小程序迁移说明

## 推荐架构

```text
微信小程序 UI  ── HTTPS JSON ──>  本项目后端  ──>  Instagram 官方 API
Web UI          ── HTTPS JSON ──>      │
                                      └──> 可选公开元数据适配器（默认关闭）
```

Access Token 永远只在后端。小程序与 Web 不直接调用 Meta API，也不自己抓取 Instagram 页面。

## 迁移步骤

1. 把本项目后端部署到支持 Node.js 20+ 的 HTTPS 服务。
2. 将 `META_ACCESS_TOKEN` 等配置加入托管平台环境变量。
3. 在微信公众平台把后端域名加入 `request` 合法域名。
4. 新建小程序 `services/instagram.js`，封装唯一的接口调用。
5. 页面通过服务层获得结果，不直接拼接后端路径。
6. 图片/视频 CDN 域名通常动态变化；生产环境建议全部使用后端受控地址，并按微信当前规则配置 downloadFile 合法域名。

## 小程序接口层示例

```js
// services/instagram.js
const API_BASE = "https://api.your-domain.example";

export function resolveInstagramUrl(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api/v1/resolve`,
      method: "POST",
      data: { url },
      header: { "content-type": "application/json" },
      timeout: 10000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
        } else {
          reject(new Error(response.data?.error?.message || "解析失败"));
        }
      },
      fail: reject,
    });
  });
}
```

页面只调用该函数：

```js
import { resolveInstagramUrl } from "../../services/instagram";

Page({
  data: { url: "", loading: false, result: null, error: "" },
  onInput(event) {
    this.setData({ url: event.detail.value });
  },
  async onResolve() {
    this.setData({ loading: true, error: "" });
    try {
      const data = await resolveInstagramUrl(this.data.url);
      this.setData({ result: data.result });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },
});
```

## 下载与保存

小程序保存图片或视频需要用户授权，并受微信域名、隐私接口与审核规则约束。推荐流程：

1. 用户明确点击“保存”，不要后台自动下载；
2. 调用后端返回的短时、签名下载地址；
3. 使用 `wx.downloadFile` 获取临时文件；
4. 根据媒体类型调用微信当前官方允许的保存接口；
5. 清晰提示版权责任、失败原因与相册权限用途。

当前 MVP 的下载 URL 尚未签名，只适合本地验证。生产环境应让 `/api/v1/resolve` 返回短时 token，而不是在查询参数里放远端 CDN URL。

## 审核与合规注意

- 小程序名称、描述和界面不要暗示 Instagram 官方授权；
- 提供隐私政策、用户协议、版权投诉和删除渠道；
- 明示只支持公开、获授权内容；
- 不收集 Instagram 密码、Cookie 或登录态；
- 上线前逐项核对微信最新的内容、网络、隐私与用户生成内容规则；
- 平台条款或审核不允许时，宁可只保留官方预览，也不要启用抓取回退。
