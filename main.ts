import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
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

// Round 7: the entry ships ten missions — fail loudly if the story lost one.
const configText = readFileSync(join(repoDir, 'game', 'src', 'config.js'), 'utf8');
const missionIds = [...configText.matchAll(/id: (\d+),/g)].map((m) => Number(m[1]));
const hasVault = configText.includes("name: 'The Vault'");
console.log(`missions in config: ${missionIds.length} (ids ${missionIds.join(', ')}), The Vault: ${hasVault}`);
if (missionIds.length < 10 || !hasVault) {
  throw new Error('mission list is short — expected 10 missions including The Vault');
}

// Laporkan ukuran dossier dan jumlah screenshot agar build lokal gampang dicek.
const shotFiles = existsSync(screenshotsDir)
  ? readdirSync(screenshotsDir).filter((f) => f.endsWith('.jpg'))
  : [];
console.log(`dossier.json: ${dossierBytes.length} bytes, screenshots: ${shotFiles.length} (${shotFiles.join(', ')})`);

// Round 7: the page must carry the minimap legend and the vault how-to,
// so players can read the new systems without opening the code.
const pageText = readFileSync(join(repoDir, 'game', 'index.html'), 'utf8');
const hasLegend = pageText.includes('MINIMAP') && pageText.includes('THE VAULT');
console.log(`page legend + vault how-to present: ${hasLegend}`);
if (!hasLegend) {
  throw new Error('game/index.html is missing the minimap legend or the vault how-to');
}

// Fail loudly if a dossier shot is missing or empty — a broken shot list
// must never reach the grader.
for (const name of ['1-start.jpg', '2-play.jpg', '3-mission.jpg', '4-end.jpg']) {
  const p = join(screenshotsDir, name);
  if (!existsSync(p)) throw new Error(`missing dossier screenshot: ${name}`);
  if (statSync(p).size === 0) throw new Error(`empty dossier screenshot: ${name}`);
}
