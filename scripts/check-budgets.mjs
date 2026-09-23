import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const limits = { authored: 180_000, document: 2_000_000, totalData: 8_000_000 };

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
      ),
    )
  ).flat();
}

const root = fileURLToPath(new URL('../', import.meta.url));
const authoredFiles = [
  join(root, 'index.html'),
  join(root, 'style.css'),
  ...(await files(join(root, 'src'))),
];
const authoredBytes = (await Promise.all(authoredFiles.map(stat))).reduce(
  (total, entry) => total + entry.size,
  0,
);
const dataFiles = await files(join(root, 'data'));
const dataStats = await Promise.all(dataFiles.map(async (file) => [file, await stat(file)]));
const failures = [];
if (authoredBytes > limits.authored)
  failures.push(`authored HTML/CSS/JS is ${authoredBytes} bytes (limit ${limits.authored})`);
for (const [file, entry] of dataStats)
  if (entry.size > limits.document)
    failures.push(`${file} is ${entry.size} bytes (per-document limit ${limits.document})`);
const totalData = dataStats.reduce((total, [, entry]) => total + entry.size, 0);
if (totalData > limits.totalData)
  failures.push(`generated data is ${totalData} bytes (limit ${limits.totalData})`);
if (failures.length) throw new Error(`Budget failure:\n${failures.join('\n')}`);
console.log(
  `Budgets passed: authored ${authoredBytes} B; generated ${totalData} B across ${dataFiles.length} documents.`,
);
