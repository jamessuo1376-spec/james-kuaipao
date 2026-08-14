import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInstagramUrl, isAllowedMediaUrl } from "../src/url-policy.js";

test("normalizes supported Instagram links and removes tracking", () => {
  assert.equal(
    normalizeInstagramUrl("https://instagram.com/reel/ABC_123/?igsh=tracking"),
    "https://www.instagram.com/reel/ABC_123/",
  );
});

test("rejects non-Instagram and profile URLs", () => {
  assert.throws(() => normalizeInstagramUrl("https://example.com/reel/ABC/"));
  assert.throws(() => normalizeInstagramUrl("https://instagram.com/someone/"));
});

test("allows only known Instagram CDN media URLs", () => {
  assert.equal(isAllowedMediaUrl("https://scontent.cdninstagram.com/file.jpg"), true);
  assert.equal(isAllowedMediaUrl("https://scontent.xx.fbcdn.net/file.mp4"), true);
  assert.equal(isAllowedMediaUrl("https://evil.example/file.mp4"), false);
});
