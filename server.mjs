import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 3000);

if (!fs.existsSync(distDir)) {
  console.error('Missing build output: dist/. Run "npm run build" before "npm run start".');
  process.exit(1);
}

const app = express();

app.use(
  express.static(distDir, {
    index: false,
  }),
);

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serving dist on http://localhost:${port}`);
});
