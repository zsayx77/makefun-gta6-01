// Screenshot presets: ?shot=start|play|mission|end arranges a fixed game state
// so the four dossier shots are reproducible.
export function applyShot(game, shot) {
  if (shot === 'start') {
    game.state = 'title';
    game.centerCamera();
    return;
  }
  if (shot === 'play') {
    game.state = 'playing';
    game.cash = 1250;
    game.wanted = 4;
    game.timeSinceCrime = 0;
    game.missionIndex = 0;
    game.missionTimer = 0;
    game.dayTime = 17.8;
    game.enterCar(game.spawnPlayerCar(3000, 1200, -Math.PI / 2, '#c0392b'));
    game.player.x = 3000;
    game.player.y = 1200;
    game.spawnPoliceNear(2);
    game.world.helicopters.push({ x: 2850, y: 980, hp: 3, rotor: 0, bob: 0 });
    game.centerCamera();
    return;
  }
  if (shot === 'mission') {
    game.state = 'playing';
    game.cash = 1650;
    game.wanted = 2;
    game.timeSinceCrime = 0;
    game.missionIndex = 5;
    game.startMission(game.currentMission());
    game.missionTimer = 0;
    game.dayTime = 22.0;
    game.enterCar(game.spawnPlayerCar(900, 840, 0, '#2980b9'));
    game.player.x = 900;
    game.player.y = 840;
    game.spawnPoliceNear(2);
    game.centerCamera();
    return;
  }
  if (shot === 'end') {
    game.state = 'busted';
    game.wanted = 5;
    game.cash = 2400;
    game.bustedReason = 'Caught by the VCPD after a five-star chase through Velvet Bay.';
    game.centerCamera();
    return;
  }
}
