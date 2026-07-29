import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const analysisRoot = path.join(root, "meta-analysis");
const outputRoot = path.join(root, "dist");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const figureCopy = {
  power_board: {
    title: "实力榜",
    caption: "套牌强度与总体胜率",
  },
  matchup: {
    title: "对战矩阵",
    caption: "主流套牌之间的优劣关系",
  },
  meta_positioning: {
    title: "环境定位",
    caption: "使用率、强度与环境位置",
  },
  best_counters: {
    title: "最佳克制",
    caption: "针对热门套牌的反制选择",
  },
};

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function listPngFiles(directory) {
  if (!(await exists(directory))) return [];
  return (await readdir(directory))
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort();
}

function figureKey(file) {
  return Object.keys(figureCopy).find((key) => file.startsWith(`${key}_`)) ?? "other";
}

async function collectFigures({ date, mode, sourceDirectory }) {
  const files = await listPngFiles(sourceDirectory);
  if (files.length === 0) return [];

  const destination = path.join(outputRoot, "meta-analysis", mode, date);
  await mkdir(destination, { recursive: true });

  const figures = [];
  for (const file of files) {
    await copyFile(path.join(sourceDirectory, file), path.join(destination, file));
    const key = figureKey(file);
    figures.push({
      key,
      title: figureCopy[key]?.title ?? file.replace(/\.png$/i, ""),
      caption: figureCopy[key]?.caption ?? "对战分析图",
      src: `meta-analysis/${mode}/${date}/${file}`,
    });
  }

  const preferredOrder = ["power_board", "matchup", "meta_positioning", "best_counters"];
  return figures.sort(
    (left, right) =>
      preferredOrder.indexOf(left.key) - preferredOrder.indexOf(right.key),
  );
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const dateDirectories = (await readdir(analysisRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && datePattern.test(entry.name))
  .map((entry) => entry.name);

const cumulativeRoot = path.join(analysisRoot, "cumulative");
const cumulativeDates = (await exists(cumulativeRoot))
  ? (await readdir(cumulativeRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && datePattern.test(entry.name))
      .map((entry) => entry.name)
  : [];

const dates = [...new Set([...dateDirectories, ...cumulativeDates])].sort((a, b) =>
  b.localeCompare(a),
);

if (dates.length === 0) {
  throw new Error("meta-analysis 中没有找到 YYYY-MM-DD 格式的日期目录。");
}

const entries = [];
for (const date of dates) {
  const dailyFigures = await collectFigures({
    date,
    mode: "daily",
    sourceDirectory: path.join(analysisRoot, date, "figures"),
  });

  // 累计图支持两种位置，优先使用 meta-analysis/cumulative/YYYY-MM-DD/figures。
  const primaryCumulative = path.join(cumulativeRoot, date, "figures");
  const fallbackCumulative = path.join(analysisRoot, date, "cumulative_figures");
  const cumulativeSource = (await exists(primaryCumulative))
    ? primaryCumulative
    : fallbackCumulative;
  const cumulativeFigures = await collectFigures({
    date,
    mode: "cumulative",
    sourceDirectory: cumulativeSource,
  });

  entries.push({
    date,
    daily: dailyFigures,
    cumulative: cumulativeFigures,
  });
}

await Promise.all([
  copyFile(path.join(root, "index.html"), path.join(outputRoot, "index.html")),
  copyFile(path.join(root, "styles.css"), path.join(outputRoot, "styles.css")),
  copyFile(path.join(root, "app.js"), path.join(outputRoot, "app.js")),
  writeFile(
    path.join(outputRoot, "site-data.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), dates: entries }),
    "utf8",
  ),
  writeFile(path.join(outputRoot, ".nojekyll"), "", "utf8"),
]);

console.log(`Built image gallery for ${entries.length} date(s).`);
