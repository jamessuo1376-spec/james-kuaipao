import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeInstagramUrl, isAllowedMediaUrl } from "./url-policy.js";
import { resolveWithOfficialOEmbed, resolveWithPublicMetadata, ProviderError } from "./providers.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

export function createApp(config, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;

  return async function handler(req, res) {
    setSecurityHeaders(res);
    try {
      const requestUrl = new URL(req.url, config.publicBaseUrl);
      if (req.method === "GET" && requestUrl.pathname === "/api/v1/health") {
        return json(res, 200, { ok: true, officialApiConfigured: Boolean(config.metaAccessToken) });
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/v1/resolve") {
        const body = await readJson(req);
        const sourceUrl = normalizeInstagramUrl(body.url);
        let result = await resolveWithOfficialOEmbed(sourceUrl, config, fetchImpl);
        if (!result && config.enablePublicMetadataFallback) {
          result = await resolveWithPublicMetadata(sourceUrl, fetchImpl);
        }
        if (!result) {
          throw new ProviderError(
            "尚未配置官方 API，且公开元数据回退未启用。请查看 README 配置 .env。",
            "PROVIDER_NOT_CONFIGURED",
          );
        }
        result.media = result.media.map((item, index) => ({
          ...item,
          downloadUrl: `/api/v1/download?url=${encodeURIComponent(item.url)}&n=${index + 1}`,
        }));
        return json(res, 200, { ok: true, sourceUrl, result });
      }
      if (req.method === "GET" && requestUrl.pathname === "/api/v1/download") {
        return proxyDownload(requestUrl.searchParams.get("url"), res, fetchImpl);
      }
      if (req.method === "GET") return serveStatic(requestUrl.pathname, res);
      return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "接口不存在" } });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 500) console.error(error);
      return json(res, status, {
        ok: false,
        error: { code: error.code || "INTERNAL_ERROR", message: status === 500 ? "服务器暂时出错" : error.message },
      });
    }
  };
}

async function proxyDownload(rawUrl, res, fetchImpl) {
  if (!isAllowedMediaUrl(rawUrl)) {
    return json(res, 400, { ok: false, error: { code: "INVALID_MEDIA_URL", message: "不允许的媒体来源" } });
  }
  const upstream = await fetchImpl(rawUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!upstream.ok || !upstream.body) {
    return json(res, 502, { ok: false, error: { code: "DOWNLOAD_FAILED", message: "媒体地址已失效" } });
  }
  const type = upstream.headers.get("content-type") || "application/octet-stream";
  if (!type.startsWith("image/") && !type.startsWith("video/")) {
    return json(res, 415, { ok: false, error: { code: "UNSUPPORTED_MEDIA", message: "远端内容不是图片或视频" } });
  }
  res.writeHead(200, {
    "content-type": type,
    "content-disposition": `attachment; filename="instagram-media.${type.startsWith("video/") ? "mp4" : "jpg"}"`,
    "cache-control": "private, max-age=300",
  });
  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!res.write(value)) await new Promise((resolve) => res.once("drain", resolve));
  }
  res.end();
}

function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = join(publicDir, safePath);
  if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) {
    return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "页面不存在" } });
  }
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

async function readJson(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 10_000) throw Object.assign(new Error("请求内容过大"), { statusCode: 413, code: "BODY_TOO_LARGE" });
  }
  try { return JSON.parse(data || "{}"); } catch { throw Object.assign(new Error("JSON 格式无效"), { statusCode: 400, code: "INVALID_JSON" }); }
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function setSecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("content-security-policy", "default-src 'self'; img-src 'self' https://*.cdninstagram.com https://*.fbcdn.net; media-src 'self' https://*.cdninstagram.com https://*.fbcdn.net; style-src 'self'; script-src 'self'; frame-src https://www.instagram.com");
}
