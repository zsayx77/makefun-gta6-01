import { cpSync, existsSync, mkdirSync, writeFileSync, statSync, readdirSync } from 'node:fs';
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
if (!existsSync(screenshotsDir)) {
  throw new Error('screenshots/ is missing — take the four dossier shots first');
}
const shotNames = readdirSync(screenshotsDir).filter((n) => !n.startsWith('.')).sort();
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shotNames.length}`);
}
cpSync(screenshotsDir, join(outDir, 'screenshots'), { recursive: true });

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

// Verifikasi: dossier tertulis dan ukurannya masuk batas gate.
const dossierSize = statSync(join(outDir, 'dossier.json')).size;
if (dossierSize > 1572864) {
  throw new Error(`dossier.json is ${dossierSize} bytes, over the 1.5 MiB gate cap`);
}
console.log(
  `Velvet Bay dossier: ${dossierSize} bytes, shots: ${shotNames.join(', ')} -> ${outDir}`
);
