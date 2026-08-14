import test from "node:test";
import assert from "node:assert/strict";
import { resolveWithPublicMetadata } from "../src/providers.js";

test("extracts safe public Open Graph media", async () => {
  const fakeFetch = async () => new Response(`
    <meta property="og:title" content="A public reel &amp; caption">
    <meta property="og:image" content="https://scontent.cdninstagram.com/preview.jpg">
    <meta property="og:video" content="https://video.xx.fbcdn.net/video.mp4">
  `, { status: 200, headers: { "content-type": "text/html" } });
  const result = await resolveWithPublicMetadata("https://www.instagram.com/reel/ABC/", fakeFetch);
  assert.equal(result.title, "A public reel & caption");
  assert.equal(result.media.length, 1);
  assert.equal(result.media[0].type, "video");
});

test("uses the public embed video for a Reel and treats og:image as poster only", async () => {
  const fakeFetch = async (url) => {
    if (String(url).includes("/embed/captioned/")) {
      return new Response(String.raw`data={\"video_url\":\"https:\/\/video.xx.fbcdn.net\/clip.mp4?x=1\u0026y=2\"}`, { status: 200 });
    }
    return new Response(`
      <meta property="og:title" content="Public Reel">
      <meta property="og:image" content="https://scontent.cdninstagram.com/poster.jpg">
    `, { status: 200 });
  };
  const result = await resolveWithPublicMetadata("https://www.instagram.com/reel/ABC/", fakeFetch);
  assert.equal(result.media.length, 1);
  assert.equal(result.media[0].type, "video");
  assert.equal(result.media[0].url, "https://video.xx.fbcdn.net/clip.mp4?x=1&y=2");
  assert.equal(result.thumbnailUrl, "https://scontent.cdninstagram.com/poster.jpg");
});
