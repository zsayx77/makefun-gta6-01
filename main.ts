// Build the submission dossier: copy the static game + screenshots into the
// output directory, then let the kit vendor build dossier.json from it.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const root = process.cwd();

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(path.join(root, 'game'), path.join(outDir, 'game'), { recursive: true });

const shotsDir = path.join(root, 'screenshots');
if (existsSync(shotsDir)) {
  await cp(shotsDir, path.join(outDir, 'screenshots'), { recursive: true });
}

const dossier = await buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// buildDossier returns the dossier JSON as bytes (Uint8Array) — write them
// directly instead of re-encoding.
const dossierBytes =
  dossier instanceof Uint8Array
    ? dossier
    : Buffer.from(typeof dossier === 'string' ? dossier : JSON.stringify(dossier, null, 2));
await writeFile(path.join(outDir, 'dossier.json'), dossierBytes);
console.log(`dossier written: ${path.join(outDir, 'dossier.json')}`);
