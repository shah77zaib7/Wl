#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, ".vercel", "output");
const staticDir = path.join(out, "static");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(path.join(out, "functions"), { recursive: true, force: true });
fs.rmSync(path.join(out, "nitro.json"), { force: true });
for (const extra of ["assets", "__grok"]) {
  fs.rmSync(path.join(staticDir, extra), { recursive: true, force: true });
}
fs.mkdirSync(path.join(staticDir, "src", "css"), { recursive: true });
fs.mkdirSync(path.join(staticDir, "src", "js"), { recursive: true });

const htmlPath = path.join(root, "wl.html");
const cssPath = path.join(root, "src", "css", "wl.css");
const jsPath = path.join(root, "src", "js", "wl.js");

if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
  throw new Error("Missing wl.html, src/css/wl.css, or src/js/wl.js");
}

copyFile(htmlPath, path.join(staticDir, "wl.html"));
copyFile(htmlPath, path.join(staticDir, "index.html"));
copyFile(cssPath, path.join(staticDir, "src", "css", "wl.css"));
copyFile(jsPath, path.join(staticDir, "src", "js", "wl.js"));

fs.writeFileSync(path.join(staticDir, "build-id.txt"), "zec-desk-wl-v4\n");

fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "/",
          dest: "/index.html",
        },
        {
          handle: "filesystem",
        },
      ],
    },
    null,
    2
  ) + "\n"
);

console.log("Wrote static Vercel output to .vercel/output/static");
