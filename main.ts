import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Lokasi repo diturunkan dari lokasi file ini sendiri, bukan dari cwd,
// karena grader menjalankan main.ts dari direktori lain.
const repoDir = fileURLToPath(new URL('.', import.meta.url));

// Direktori output dari env, default /output. Direktori ini TIDAK PERNAH
// dihapus — grader memasang /output sebagai mount point read-only, jadi
// cukup dibuat (rekursif) bila belum ada.
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });

// Salin game dan screenshot dari repo ke output.
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });

const screenshotsDir = join(repoDir, 'screenshots');
if (existsSync(screenshotsDir)) {
  cpSync(screenshotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// buildDossier mengembalikan Uint8Array berisi dossier.json — tulis
// byte-nya langsung, jangan di-stringify ulang.
const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
