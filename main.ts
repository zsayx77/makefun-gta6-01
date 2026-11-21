import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
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

// Laporkan ukuran dossier dan jumlah screenshot agar build lokal gampang dicek.
const shotFiles = existsSync(screenshotsDir)
  ? readdirSync(screenshotsDir).filter((f) => f.endsWith('.jpg'))
  : [];
console.log(`dossier.json: ${dossierBytes.length} bytes, screenshots: ${shotFiles.length} (${shotFiles.join(', ')})`);

// Fail loudly if a dossier shot is missing or empty — a broken shot list
// must never reach the grader.
for (const name of ['1-start.jpg', '2-play.jpg', '3-mission.jpg', '4-end.jpg']) {
  const p = join(screenshotsDir, name);
  if (!existsSync(p)) throw new Error(`missing dossier screenshot: ${name}`);
  if (statSync(p).size === 0) throw new Error(`empty dossier screenshot: ${name}`);
}
