import archiver from 'archiver';
import { createWriteStream, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outDir = join(root, 'dist');
const outFile = join(outDir, `wallabag-${version}.zip`);

const files = ['main.js', 'manifest.json', 'styles.css'];
for (const name of files) {
  const p = join(root, name);
  if (!existsSync(p)) {
    console.error(`Missing ${name}; run npm run build first.`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });

const output = createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', (err) => {
  throw err;
});

output.on('close', () => {
  console.log(`${outFile} (${archive.pointer()} bytes)`);
});

archive.pipe(output);
for (const name of files) {
  archive.file(join(root, name), { name });
}

archive.finalize();
