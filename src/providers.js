import { isAllowedMediaUrl } from "./url-policy.js";

export async function resolveWithOfficialOEmbed(instagramUrl, config, fetchImpl = fetch) {
  if (!config.metaAccessToken) return null;

  const endpoint = new URL(
    `https://graph.facebook.com/${config.metaGraphVersion}/instagram_oembed`,
  );
  endpoint.searchParams.set("url", instagramUrl);
  endpoint.searchParams.set("access_token", config.metaAccessToken);
  endpoint.searchParams.set("omitscript", "true");

  const response = await fetchImpl(endpoint, {
    headers: { "user-agent": "InstagramPublicMediaMVP/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProviderError(
      body?.error?.message || "Instagram 官方接口暂时无法解析此链接",
      "OFFICIAL_API_ERROR",
    );
  }

  return {
    provider: "instagram-oembed",
    title: body.title || "Instagram 公开内容",
    authorName: body.author_name || "",
    authorUrl: body.author_url || "",
    thumbnailUrl: body.thumbnail_url || "",
    media: [],
    embedHtml: body.html || "",
    note: "官方 oEmbed 返回预览信息，不保证提供原始媒体文件下载地址。",
  };
}

export async function resolveWithPublicMetadata(instagramUrl, fetchImpl = fetch) {
  const response = await fetchImpl(instagramUrl, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new ProviderError("公开页面不可访问，可能需要登录或受到地区限制", "PUBLIC_PAGE_UNAVAILABLE");
  }

  const html = await response.text();
  const getMeta = (property) => {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    ];
    return decodeHtml((html.match(patterns[0]) || html.match(patterns[1]))?.[1] || "");
  };

  let video = getMeta("og:video") || getMeta("og:video:secure_url");
  const image = getMeta("og:image");
  // Public Reel pages often expose only a poster. Instagram's public embed page
  // may still include the playable media used by the official embed itself.
  const isReel = /\/reels?\//.test(new URL(instagramUrl).pathname);
  if (!isAllowedMediaUrl(video) && isReel) {
    video = await resolvePublicEmbedVideo(instagramUrl, fetchImpl);
  }
  const media = [];
  if (isAllowedMediaUrl(video)) media.push({ type: "video", url: video });
  // For a Reel, the og:image is a poster rather than an independent downloadable
  // media item. Keep it as thumbnailUrl but do not mislabel it as the result.
  if (isAllowedMediaUrl(image) && (!isReel || !isAllowedMediaUrl(video))) {
    media.push({ type: "image", url: image });
  }
  if (!media.length) {
    throw new ProviderError("页面没有暴露可安全使用的公开媒体地址", "NO_PUBLIC_MEDIA");
  }

  return {
    provider: "public-page-metadata",
    title: getMeta("og:title") || "Instagram 公开内容",
    authorName: "",
    authorUrl: "",
    thumbnailUrl: image,
    media,
    embedHtml: "",
    note: "结果来自公开页面元数据，可能失效；请仅下载你有权保存的内容。",
  };
}

async function resolvePublicEmbedVideo(instagramUrl, fetchImpl) {
  const embedUrl = `${instagramUrl.replace(/\/$/, "")}/embed/captioned/`;
  const response = await fetchImpl(embedUrl, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const html = await response.text();

  const plain = html.match(/"video_url"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const escaped = html.match(/\\"video_url\\"\s*:\s*\\"((?:\\.|[^"\\])*)\\"/);
  const raw = plain?.[1] || escaped?.[1] || "";
  if (!raw) return "";
  try {
    // The value can be nested inside a JSON string, so normalize escaped slashes
    // and ampersands without evaluating any page script.
    return raw
      .replaceAll("\\\\/", "/")
      .replaceAll("\\/", "/")
      .replaceAll("\\u0026", "&")
      .replaceAll("&amp;", "&");
  } catch {
    return "";
  }
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.statusCode = 422;
    this.code = code;
  }
}
