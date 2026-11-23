# VELVET COAST

A 3D open-world crime game set in **Port Solana**, a sun-baked coastal city of downtown towers, beachfront hotels, a marina, and a causeway out to an island mansion. You play **Marco Varela**, a former soldier back in his hometown after twelve years away. Old friends pull him into one last run of jobs — and the man behind it all is El Faro, the crime boss who owns the coast.

## Play

```bash
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step, no network requests: the game is plain static files (`game/index.html` and its ES modules) with three.js vendored under `game/`.

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive |
| Mouse | Look (click to lock the pointer) |
| F | Enter / exit vehicle |
| V | Toggle camera (far / close) |
| Tab | Change radio station |
| 1 / 2 / 3 | Fists / pistol / SMG |
| R | Reload |
| E | Advance dialogue / interact |
| Esc | Pause menu |
| Enter | Start / confirm |

## Features

- **Open world** — a 5x5-block city grid with downtown towers, midrise blocks, warehouses, a beach, marina, causeway, and island mansion, plus a living ocean and day/night cycle.
- **10 story missions** — from a pickpocket chase at the safehouse to storming El Faro's mansion, with dialogue, choices (Mission 9 decides Dex's fate), chases, deliveries, and multi-wave shootouts.
- **Wanted system** — 0–5 stars. Police cars and officers hunt you, a helicopter joins at high heat, and you lose them by breaking line of sight.
- **Driving** — four vehicle types (muscle, sports, sedan, van) plus traffic AI, pedestrians, and police pursuits with ramming.
- **Combat** — pistol and SMG with muzzle flash, recoil, reload, and explosions.
- **Radio** — three procedural stations (Sunset 88.5 FM, Wave 104.2, Vanta 90.1), engine hum, sirens, and ambient sound, all synthesized in WebAudio.
- **Weather** — clear, rain, and fog, with wet roads and lit windows at night.
- **HUD & minimap** — health, armor, cash, wanted stars, mission objective, and a live minimap.
- **Save / load** — progress autosaves between missions (localStorage).

## Screenshots

1. `1_cover.png` — golden-hour chase downtown in the Moro muscle car, 2 wanted stars.
2. `2_combat.png` — pistol firefight in a downtown alley, 4 wanted stars.
3. `3_mission.png` — Mission 2 "Eleven Years": Dex's intro and the valet-lot job.
4. `4_night.png` — rainy night drive downtown, Sunset 88.5 FM on the radio.

## make.fun

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/claymoreth/gta6-01-velvet-coast/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/claymoreth/gta6-01-velvet-coast/reward.svg)](https://make.fun/bounty/gta6-01)

Bounty: <https://make.fun/bounty/gta6-01>
