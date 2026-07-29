import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const analysisRoot = path.join(root, "meta-analysis");
const outputRoot = path.join(root, "dist");
const publicImageRoot =
  "https://raw.githubusercontent.com/zrwrz/pokemon-challenge-meta-eval/main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const cumulativeRangePattern =
  /^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/;

const figureCopy = {
  power_board: {
    title: "Power Board",
    caption: "Deck strength and overall win rate",
  },
  matchup: {
    title: "Matchup Matrix",
    caption: "Advantages and disadvantages among leading decks",
  },
  meta_positioning: {
    title: "Meta Positioning",
    caption: "Usage, strength, and position in the field",
  },
  best_counters: {
    title: "Best Counters",
    caption: "Counter choices for the most popular decks",
  },
  usage_trend: {
    title: "Usage Trend",
    caption: "Deck usage changes across the cumulative window",
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
  return (
    Object.keys(figureCopy).find(
      (key) => file === `${key}.png` || file.startsWith(`${key}_`),
    ) ?? "other"
  );
}

async function collectFigures({ date, mode, sourceDirectory, sourceWebDirectory }) {
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
      caption: figureCopy[key]?.caption ?? "Meta analysis report",
      src: `meta-analysis/${mode}/${date}/${file}`,
      sourcePath: `${sourceWebDirectory}/${file}`,
    });
  }

  const preferredOrder = [
    "power_board",
    "matchup",
    "meta_positioning",
    "best_counters",
    "usage_trend",
  ];
  return figures.sort(
    (left, right) => {
      const leftIndex = preferredOrder.indexOf(left.key);
      const rightIndex = preferredOrder.indexOf(right.key);
      return (
        (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
      );
    },
  );
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const analysisDirectories = await readdir(analysisRoot, { withFileTypes: true });
const dateDirectories = analysisDirectories
  .filter((entry) => entry.isDirectory() && datePattern.test(entry.name))
  .map((entry) => entry.name);
const cumulativeRanges = analysisDirectories
  .filter((entry) => entry.isDirectory() && cumulativeRangePattern.test(entry.name))
  .map((entry) => {
    const [, startDate, endDate] = entry.name.match(cumulativeRangePattern);
    return { name: entry.name, startDate, endDate };
  })
  .sort((left, right) => left.startDate.localeCompare(right.startDate));

const cumulativeRoot = path.join(analysisRoot, "cumulative");
const cumulativeDates = (await exists(cumulativeRoot))
  ? (await readdir(cumulativeRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && datePattern.test(entry.name))
      .map((entry) => entry.name)
  : [];

const dates = [
  ...new Set([
    ...dateDirectories,
    ...cumulativeDates,
    ...cumulativeRanges.map((range) => range.endDate),
  ]),
].sort((a, b) => b.localeCompare(a));

if (dates.length === 0) {
  throw new Error("No YYYY-MM-DD analysis directories were found.");
}

const entries = [];
for (const date of dates) {
  const dailyFigures = await collectFigures({
    date,
    mode: "daily",
    sourceDirectory: path.join(analysisRoot, date, "figures"),
    sourceWebDirectory: `meta-analysis/${date}/figures`,
  });

  // Prefer the generator's START_to_END/figures directory for cumulative reports.
  const matchingRange = cumulativeRanges.find((range) => range.endDate === date);
  const rangeCumulative = matchingRange
    ? path.join(analysisRoot, matchingRange.name, "figures")
    : null;
  const primaryCumulative = path.join(cumulativeRoot, date, "figures");
  const fallbackCumulative = path.join(analysisRoot, date, "cumulative_figures");
  const cumulativeSource =
    rangeCumulative && (await exists(rangeCumulative))
      ? rangeCumulative
      : (await exists(primaryCumulative))
        ? primaryCumulative
        : fallbackCumulative;
  const cumulativeWebDirectory =
    rangeCumulative && cumulativeSource === rangeCumulative
      ? `meta-analysis/${matchingRange.name}/figures`
      : cumulativeSource === primaryCumulative
        ? `meta-analysis/cumulative/${date}/figures`
        : `meta-analysis/${date}/cumulative_figures`;
  const cumulativeFigures = await collectFigures({
    date,
    mode: "cumulative",
    sourceDirectory: cumulativeSource,
    sourceWebDirectory: cumulativeWebDirectory,
  });

  entries.push({
    date,
    daily: dailyFigures,
    cumulative: cumulativeFigures,
  });
}

const generatedAt = `${dates[0]}T00:00:00.000Z`;
const siteData = { generatedAt, dates: entries };
const publicData = {
  generatedAt,
  dates: entries.map((entry) => ({
    date: entry.date,
    daily: entry.daily.map(({ sourcePath, ...figure }) => ({
      ...figure,
      src: `${publicImageRoot}/${sourcePath}`,
    })),
    cumulative: entry.cumulative.map(({ sourcePath, ...figure }) => ({
      ...figure,
      src: `${publicImageRoot}/${sourcePath}`,
    })),
  })),
};

await Promise.all([
  copyFile(path.join(root, "index.html"), path.join(outputRoot, "index.html")),
  copyFile(path.join(root, "styles.css"), path.join(outputRoot, "styles.css")),
  copyFile(path.join(root, "app.js"), path.join(outputRoot, "app.js")),
  writeFile(
    path.join(outputRoot, "site-data.json"),
    JSON.stringify(siteData),
    "utf8",
  ),
  writeFile(
    path.join(root, "gallery-manifest.json"),
    JSON.stringify(publicData),
    "utf8",
  ),
  writeFile(path.join(outputRoot, ".nojekyll"), "", "utf8"),
]);

console.log(`Built image gallery for ${entries.length} date(s).`);
