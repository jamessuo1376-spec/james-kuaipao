import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

loadDotEnv();
const config = loadConfig();
const server = createServer(createApp(config));
server.listen(config.port, () => {
  console.log(`MVP 已启动：http://localhost:${config.port}`);
});

function loadDotEnv() {
  const path = resolve(".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[2].startsWith("#")) continue;
    if (!(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
