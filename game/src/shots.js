// Screenshot presets: ?shot=start|play|mission|end arranges a fixed game state
// so the four dossier shots are reproducible. &tod=<hours> sets the clock:
// start is a bright morning, play is golden hour with a helicopter overhead,
// mission is a sunset finale on the Boardwalk, end is the story complete at night.
export function applyShot(game, shot) {
  const params = new URLSearchParams(location.search);
  const tod = parseFloat(params.get('tod'));
  if (Number.isFinite(tod)) game.dayTime = tod;
  if (shot === 'start') {
    game.state = 'title';
    game.centerCamera();
    return;
  }
  if (shot === 'play') {
    game.state = 'playing';
    game.cash = 2450;
    game.wanted = 4;
    game.timeSinceCrime = 0;
    game.missionIndex = 5;
    game.startMission(game.currentMission());
    game.enterCar(game.spawnPlayerCar(1000, 840, 0, '#c0392b'));
    game.player.x = 1000;
    game.player.y = 840;
    game.spawnPoliceNear(2);
    game.spawnHeliNear();
    game.centerCamera();
    return;
  }
  if (shot === 'mission') {
    game.state = 'playing';
    game.cash = 4100;
    game.wanted = 5;
    game.timeSinceCrime = 0;
    game.missionIndex = 8;
    game.startMission(game.currentMission());
    game.enterCar(game.world.auroraCar);
    game.player.x = game.world.auroraCar.x;
    game.player.y = game.world.auroraCar.y;
    game.spawnPoliceNear(2);
    game.spawnHeliNear();
    game.spawnHeliNear();
    game.centerCamera();
    return;
  }
  if (shot === 'end') {
    game.state = 'complete';
    game.missionIndex = 9;
    game.cash = 6400;
    game.centerCamera();
    return;
  }
}
