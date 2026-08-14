const ALLOWED_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

const ALLOWED_PATH_TYPES = new Set(["p", "reel", "reels", "tv"]);

export function normalizeInstagramUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    throw new UserInputError("请输入有效的 Instagram 分享链接");
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UserInputError("仅支持 instagram.com 的 HTTPS 分享链接");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || !ALLOWED_PATH_TYPES.has(parts[0]) || !/^[\w-]+$/.test(parts[1])) {
    throw new UserInputError("目前仅支持帖子、Reels 和 IGTV 分享链接");
  }

  return `https://www.instagram.com/${parts[0]}/${parts[1]}/`;
}

export function isAllowedMediaUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host.endsWith(".cdninstagram.com") ||
        host === "cdninstagram.com" ||
        host.endsWith(".fbcdn.net") ||
        host === "fbcdn.net")
    );
  } catch {
    return false;
  }
}

export class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
    this.code = "INVALID_URL";
  }
}
