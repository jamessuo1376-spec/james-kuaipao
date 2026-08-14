const form = document.querySelector("#resolve-form");
const status = document.querySelector("#status");
const result = document.querySelector("#result");

document.querySelector(".wechat-contact").addEventListener("click", async () => {
  await navigator.clipboard?.writeText("JamesMarlboro0309");
  document.querySelector(".wechat-contact").textContent = "微信号已复制";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  status.className = "";
  status.textContent = "正在通过已配置的数据源解析…";
  result.hidden = true;

  try {
    const response = await fetch("/api/v1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: form.elements.url.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "解析失败");
    renderResult(data);
    status.textContent = `解析完成 · 数据源：${data.result.provider}`;
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function renderResult(data) {
  const { result: item, sourceUrl } = data;
  result.replaceChildren();
  const title = el("h2", {}, item.title || "Instagram 公开内容");
  const note = el("p", { className: "result-note" }, item.note);
  const source = el("a", { className: "source-link", href: sourceUrl, target: "_blank", rel: "noreferrer" }, "在 Instagram 查看原内容 ↗");
  result.append(title, note, source);

  if (item.thumbnailUrl && item.media.length === 0) {
    const grid = el("div", { className: "media-grid" });
    grid.append(el("img", { src: item.thumbnailUrl, alt: "Instagram 内容预览", referrerPolicy: "no-referrer" }));
    result.append(grid, el("p", { className: "result-note" }, "官方 oEmbed 仅提供预览。此内容没有可下载的公开媒体地址。"));
  } else if (item.media.length) {
    const grid = el("div", { className: "media-grid" });
    item.media.forEach((media, i) => {
      const box = el("article", { className: "media-item" });
      const preview = media.type === "video"
        ? el("video", { src: media.url, controls: true, playsInline: true })
        : el("img", { src: media.url, alt: `媒体 ${i + 1}`, referrerPolicy: "no-referrer" });
      const download = el("a", { className: "download", href: media.downloadUrl }, `下载${media.type === "video" ? "视频" : "图片"}`);
      box.append(preview, download);
      grid.append(box);
    });
    result.append(grid);
  }
  result.hidden = false;
}

function el(tag, attributes = {}, text = "") {
  const node = document.createElement(tag);
  Object.assign(node, attributes);
  if (text) node.textContent = text;
  return node;
}
