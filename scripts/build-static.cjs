// Build a complete static deployment with Hanzi Writer + stroke JSON hosted on this site.
// Run: npm install && npm run build
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "dist");
const ignoredDirs = new Set([".git", ".github", ".vercel", "node_modules", "dist", "scripts", "tests", ".next"]);
const ignoredFiles = new Set(["package.json", "package-lock.json", "vercel.json", ".gitignore"]);

function copySite(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    if (entry.isFile() && ignoredFiles.has(entry.name)) continue;
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copySite(source, target);
    else if (entry.isFile()) fs.copyFileSync(source, target);
  }
}

function collectCharacters(directory, characters) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) collectCharacters(full, characters);
      continue;
    }
    if (!entry.isFile() || !/\.(?:txt|json|js|html)$/i.test(entry.name)) continue;
    if (fs.statSync(full).size > 8_000_000) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const char of text.match(/\p{Script=Han}/gu) || []) characters.add(char);
  }
}

fs.rmSync(out, { recursive: true, force: true });
copySite(root, out);

const vendor = path.join(out, "vendor");
const dataOut = path.join(vendor, "hanzi-data");
fs.mkdirSync(dataOut, { recursive: true });

const writer = path.join(root, "node_modules/hanzi-writer/dist/hanzi-writer.min.js");
const pinyin = path.join(root, "node_modules/pinyin-pro/dist/index.js");
const dataRoot = path.join(root, "node_modules/hanzi-writer-data");
for (const file of [writer, pinyin, path.join(dataRoot, "ARPHICPL.TXT")]) {
  if (!fs.existsSync(file)) throw new Error("缺少本地依赖: " + file + "；请先运行 npm install");
}
fs.copyFileSync(writer, path.join(vendor, "hanzi-writer.min.js"));
fs.copyFileSync(pinyin, path.join(vendor, "pinyin-pro.js"));
fs.copyFileSync(path.join(dataRoot, "ARPHICPL.TXT"), path.join(vendor, "ARPHICPL.TXT"));

const writerLicense = path.join(root, "node_modules/hanzi-writer/LICENSE");
if (fs.existsSync(writerLicense)) fs.copyFileSync(writerLicense, path.join(vendor, "HANZI-WRITER-LICENSE.txt"));

const characters = new Set(["一", "人", "我", "你", "字", "永", "鹅", "山", "水"]);
collectCharacters(root, characters);
let copied = 0;
const missing = [];
for (const character of characters) {
  const filename = character + ".json";
  const source = path.join(dataRoot, filename);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(dataOut, filename));
    copied++;
  } else if (fs.existsSync(path.join(dataOut, filename))) {
    // Preserve vetted local supplements when the upstream npm package lacks the glyph.
    copied++;
  } else {
    missing.push(character);
  }
}
if (copied < 100) throw new Error("笔画文件太少，打包可能不完整: " + copied);
fs.writeFileSync(path.join(dataOut, "manifest.json"), JSON.stringify({ copied, missing }, null, 2));
console.log("本地笔画资源已打包: " + copied + " 字，缺少 " + missing.length + " 字；输出目录 dist/");
