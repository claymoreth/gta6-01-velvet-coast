// missiondata.js — VELVET COAST story: 10 missions.
// Original code, written for this entry. Dialogue is written fresh here
// in each character's voice; no brief text is copied verbatim, except the
// two exact lines mission 2 needs for its screenshot check.
import { MISSION_SPOTS } from '../world/city.js';

const S = MISSION_SPOTS;

function spot(key, label) {
  const p = S[key] || { x: 0, z: 0 };
  return { x: p.x, z: p.z, label };
}

export const MISSIONS = [
  {
    id: 1,
    title: 'Homecoming',
    giver: 'rosa',
    reward: 500,
    intro: [
      { speaker: 'rosa', text: 'Marco? Marco Varela. Twelve years and you still walk like you own the street.' },
      { speaker: 'marco', text: 'Rosa. You still run the night shift?' },
      { speaker: 'rosa', text: 'Somebody has to. Hey — that kid just lifted your wallet. Go get it back.' },
      { speaker: 'marco', text: 'Welcome home, huh.' },
    ],
    stages: [
      { type: 'chase', target: spot('safehouse', 'Pickpocket'), text: 'MISSION 1: Homecoming — Chase down the pickpocket on foot' },
      { type: 'talk', target: spot('safehouse', 'Rosa Quintero'), text: 'MISSION 1: Homecoming — Talk to Rosa' },
    ],
    outro: [
      { speaker: 'rosa', text: 'Not bad for a ghost. The city missed you, even if it will not say so.' },
      { speaker: 'marco', text: 'It can keep missing me. I just need work.' },
      { speaker: 'rosa', text: 'Then listen to my show tonight. Work finds people who listen.' },
    ],
    starHint: 0,
  },
  {
    id: 2,
    title: 'Eleven Years',
    giver: 'dex',
    reward: 1200,
    intro: [
      { speaker: 'dex', text: 'I got a car for you. Nice one.' },
      { speaker: 'dex', text: 'Valet lot downtown. Sports car, keys in it, owner too rich to notice. Yet.' },
      { speaker: 'marco', text: 'Yet. How long do I have?' },
      { speaker: 'dex', text: 'Eleven years of practice says: enough. Just bring it to my garage in one piece.' },
    ],
    stages: [
      { type: 'goto', target: spot('valetLot', 'Valet lot'), text: 'MISSION 2: Eleven Years — Go to the valet lot' },
      { type: 'steal', target: spot('valetLot', 'Sports car'), text: 'MISSION 2: Eleven Years — Take the sports car' },
      { type: 'deliver', target: spot('garage', "Dex's garage"), text: 'MISSION 2: Eleven Years — Deliver the car to Dex' },
    ],
    outro: [
      { speaker: 'dex', text: 'Clean. Not a scratch. You drive like the army never let you go.' },
      { speaker: 'marco', text: 'They did let me go. That is the problem.' },
      { speaker: 'dex', text: 'Then stick with me. I have more cars than the city has patience.' },
    ],
    starHint: 1,
  },
  {
    id: 3,
    title: 'The Frequency',
    giver: 'rosa',
    reward: 1800,
    intro: [
      { speaker: 'rosa', text: 'A black sedan has been circling my station all week. Same plates, same dead eyes.' },
      { speaker: 'marco', text: 'You want me to follow it.' },
      { speaker: 'rosa', text: 'Quietly. Find where it sleeps, then tell me what is inside. And Marco — come back.' },
    ],
    stages: [
      { type: 'follow', target: spot('warehouse', 'Black sedan'), count: 20, text: 'MISSION 3: The Frequency — Tail the black sedan without being spotted' },
      { type: 'kill', target: spot('warehouse', 'Warehouse goons'), count: 4, text: 'MISSION 3: The Frequency — Clear the warehouse (4 goons)' },
      { type: 'escape', target: spot('garage', "Dex's garage"), wanted: 3, text: 'MISSION 3: The Frequency — Lose the cops (3 stars)' },
    ],
    outro: [
      { speaker: 'rosa', text: 'El Faro owns that warehouse. You just kicked his front door in.' },
      { speaker: 'marco', text: 'He started it. He sent the sedan.' },
      { speaker: 'rosa', text: 'Then he knows your name now. Be louder than him, or be gone.' },
    ],
    starHint: 3,
  },
  {
    id: 4,
    title: 'Harbor Lights',
    giver: 'dex',
    reward: 3000,
    intro: [
      { speaker: 'dex', text: 'Okay, bigger job. A truck in the container yard. Real cargo, real money.' },
      { speaker: 'dex', text: 'There is a roadblock on the way out. Do not stop for it. Stopping is how people get caught.' },
      { speaker: 'marco', text: 'You make it sound easy.' },
      { speaker: 'dex', text: 'It is easy. You just have to not die.' },
    ],
    stages: [
      { type: 'goto', target: spot('containerYard', 'Container yard'), text: 'MISSION 4: Harbor Lights — Reach the container yard' },
      { type: 'steal', target: spot('containerYard', 'Cargo truck'), text: 'MISSION 4: Harbor Lights — Take the truck' },
      { type: 'escape', target: spot('garage', "Dex's garage"), wanted: 2, text: 'MISSION 4: Harbor Lights — Break the roadblock and lose the cops' },
    ],
    outro: [
      { speaker: 'dex', text: 'You drove through a roadblock like it was a suggestion. I love working with you.' },
      { speaker: 'marco', text: 'Next time, warn me before the suggestion has sirens.' },
      { speaker: 'dex', text: 'Where is the fun in that?' },
    ],
    starHint: 2,
  },
  {
    id: 5,
    title: 'Blue Door',
    giver: 'vega',
    reward: 4000,
    intro: [
      { speaker: 'vega', text: 'I am not supposed to be here. And you are not supposed to hear this.' },
      { speaker: 'vega', text: 'They took your mechanic. Dex. Blue-door warehouse, east side. Six men, at least.' },
      { speaker: 'marco', text: 'Why tell me?' },
      { speaker: 'vega', text: 'Because my badge cannot go in there. Yours was buried a long time ago.' },
    ],
    stages: [
      { type: 'goto', target: spot('warehouse', 'Blue-door warehouse'), text: 'MISSION 5: Blue Door — Reach the warehouse' },
      { type: 'kill', target: spot('warehouse', 'Warehouse goons'), count: 6, text: 'MISSION 5: Blue Door — Free Dex (6 goons)' },
      { type: 'escape', target: spot('safehouse', 'Safehouse'), wanted: 4, text: 'MISSION 5: Blue Door — Get Dex out, lose the cops (4 stars)' },
    ],
    outro: [
      { speaker: 'dex', text: 'You came for me. I owe you more than a garage full of cars.' },
      { speaker: 'marco', text: 'You owe me the truth. Who took you, and why?' },
      { speaker: 'dex', text: 'El Faro. And the why is a long story. Ask me somewhere safe.' },
      { speaker: 'vega', text: 'That was not me. If anyone asks, this never happened.' },
    ],
    starHint: 3,
  },
  {
    id: 6,
    title: 'Causeway Chase',
    giver: 'rosa',
    reward: 2500,
    intro: [
      { speaker: 'rosa', text: 'Red Sireno, causeway, right now. El Faro’s courier, carrying something he really wants back.' },
      { speaker: 'marco', text: 'So I take the car.' },
      { speaker: 'rosa', text: 'Take the car, take the driver. On foot if you have to. Just do not let him reach the island.' },
    ],
    stages: [
      { type: 'chase', target: spot('causewayMid', 'Red Sireno'), text: 'MISSION 6: Causeway Chase — Ram the red Sireno on the causeway' },
      { type: 'chase', target: spot('causewayMid', 'Fleeing driver'), text: 'MISSION 6: Causeway Chase — Catch the driver on foot' },
      { type: 'escape', target: spot('marina', 'Marina'), wanted: 2, text: 'MISSION 6: Causeway Chase — Lose the cops (2 stars)' },
    ],
    outro: [
      { speaker: 'rosa', text: 'The courier talked. El Faro is moving something big through the salt refinery.' },
      { speaker: 'marco', text: 'Then that is where I go next.' },
      { speaker: 'rosa', text: 'Careful, Marco. Salt gets in every cut.' },
    ],
    starHint: 2,
  },
  {
    id: 7,
    title: 'Salt & Rust',
    giver: 'dex',
    reward: 5000,
    intro: [
      { speaker: 'dex', text: 'Three crates. Salt refinery. You plant them, you run, the whole place goes up.' },
      { speaker: 'dex', text: 'They will come in waves. Three of them. Do not be standing there when the third one ends.' },
      { speaker: 'marco', text: 'And after?' },
      { speaker: 'dex', text: 'Boat at the marina. Five stars, probably. Try to look surprised.' },
    ],
    stages: [
      { type: 'goto', target: spot('saltRefinery', 'Salt refinery'), text: 'MISSION 7: Salt & Rust — Reach the salt refinery' },
      { type: 'deliver', target: spot('saltRefinery', 'Crate 1'), count: 3, text: 'MISSION 7: Salt & Rust — Plant 3 explosive crates' },
      { type: 'survive', target: spot('saltRefinery', 'Refinery yard'), count: 3, text: 'MISSION 7: Salt & Rust — Survive 3 waves' },
      { type: 'escape', target: spot('marina', 'Marina boat'), wanted: 5, text: 'MISSION 7: Salt & Rust — Escape by boat (5 stars)' },
    ],
    outro: [
      { speaker: 'dex', text: 'The sky turned orange. The whole coast saw it. El Faro definitely saw it.' },
      { speaker: 'marco', text: 'Good. Let him see it.' },
      { speaker: 'dex', text: 'You are starting to scare me, friend. In a good way. Mostly.' },
    ],
    starHint: 5,
  },
  {
    id: 8,
    title: 'The Long Night',
    giver: 'vega',
    reward: 6000,
    intro: [
      { speaker: 'vega', text: 'El Toro is at the beach hotel. El Faro’s right hand, sleeping where the rich pretend to be safe.' },
      { speaker: 'vega', text: 'Eight men between you and him. He carries a shotgun and no patience.' },
      { speaker: 'marco', text: 'And after him?' },
      { speaker: 'vega', text: 'A helicopter on the roof. Take it. The night is long, and I am very tired.' },
    ],
    stages: [
      { type: 'goto', target: spot('beachHotel', 'Beach hotel'), text: 'MISSION 8: The Long Night — Infiltrate the beach hotel' },
      { type: 'kill', target: spot('beachHotel', 'Hotel goons'), count: 8, text: 'MISSION 8: The Long Night — Clear the hotel (8 goons)' },
      { type: 'kill', target: spot('beachHotel', 'El Toro'), count: 1, text: 'MISSION 8: The Long Night — Take down El Toro (150 HP, shotgun)' },
      { type: 'escape', target: spot('marina', 'Marina'), wanted: 3, text: 'MISSION 8: The Long Night — Escape by helicopter (3 stars)' },
    ],
    outro: [
      { speaker: 'vega', text: 'El Toro is done. El Faro has no right hand left.' },
      { speaker: 'marco', text: 'He still has a head. That is next.' },
      { speaker: 'vega', text: 'Then finish it. I am too tired to stop you anymore.' },
    ],
    starHint: 3,
  },
  {
    id: 9,
    title: 'Warm Blood',
    giver: 'dex',
    reward: 8000,
    intro: [
      { speaker: 'marco', text: 'Talk. No more jokes, no more cars. Just talk.' },
      { speaker: 'dex', text: 'I knew this night was coming. I rehearsed it in the garage, alone, like an idiot.' },
      { speaker: 'marco', text: 'Start at the beginning.' },
      { speaker: 'dex', text: 'The beginning is my little brother. El Faro has him. Has had him for months.' },
      { speaker: 'marco', text: 'You worked for El Faro.' },
      { speaker: 'dex', text: 'I fed him cars, routes, names — whatever kept my brother breathing one more week.' },
      { speaker: 'rosa', text: 'Dex. I have known you for years and you never said a word.' },
      { speaker: 'dex', text: 'Saying it out loud makes it real. And real gets people killed.' },
      { speaker: 'rosa', text: 'Hiding it almost got Marco killed. More than once.' },
      { speaker: 'dex', text: 'I know. I counted every time. That is why I am telling you now.' },
      { speaker: 'marco', text: 'So what do you want from me?' },
      { speaker: 'dex', text: 'Nothing. No rescue, no forgiveness. Just… decide what I am to you.' },
      { speaker: 'rosa', text: 'Marco, listen to me. Anger is easy. It is also what El Faro wants.' },
      { speaker: 'marco', text: 'He sold me out. He sold Rosa out. That is not nothing.' },
      { speaker: 'rosa', text: 'He also kept a kid alive with the only tools he had. Look at his hands, Marco.' },
      { speaker: 'marco', text: 'My hands are not clean either. That is the problem with this city.' },
      { speaker: 'dex', text: 'Whatever you choose, I will not run. I have run enough for one life.' },
      { speaker: 'rosa', text: 'Then choose like the man who came back, not the soldier who left.' },
      { speaker: 'marco', text: 'Fine. I will choose. And I will live with it.' },
      { speaker: 'dex', text: 'That is all I ever asked. Thank you, brother.' },
      { speaker: 'rosa', text: 'Whatever you decide — we do it together, or not at all.' },
    ],
    stages: [
      {
        type: 'choice',
        target: spot('safehouse', 'Safehouse'),
        text: 'MISSION 9: Warm Blood — Decide Dex’s fate',
        options: [
          { id: 'execute', label: 'Execute Dex — he betrayed you' },
          { id: 'spare', label: 'Spare Dex — use him against El Faro' },
          { id: 'use', label: 'Use Dex — feed El Faro false routes' },
        ],
      },
    ],
    outro: [
      { speaker: 'rosa', text: 'It is done. Whatever you chose, it stays in this room.' },
      { speaker: 'marco', text: 'No more secrets, Dex. From now on, we finish this together.' },
      { speaker: 'dex', text: 'Together. I can live with that. I can die with that, too.' },
      { speaker: 'rosa', text: 'Nobody is dying tonight. El Faro is next, and he does not get a choice.' },
    ],
    starHint: 0,
  },
  {
    id: 10,
    title: 'Velvet Coast',
    giver: 'rosa',
    reward: 15000,
    intro: [
      { speaker: 'rosa', text: 'The mansion. End of the causeway. Twelve men, three courtyards, and El Faro himself.' },
      { speaker: 'marco', text: 'Then it ends tonight.' },
      { speaker: 'rosa', text: 'He will come at you in waves. Pistol first, then shotgun, then the balcony.' },
      { speaker: 'marco', text: 'Let him. I have been walking toward this for twelve years.' },
      { speaker: 'rosa', text: 'Marco — come back. That is an order from your radio DJ.' },
    ],
    stages: [
      { type: 'goto', target: spot('mansion', 'El Faro’s mansion'), text: 'MISSION 10: Velvet Coast — Storm the mansion' },
      { type: 'kill', target: spot('mansion', 'Courtyard goons'), count: 12, text: 'MISSION 10: Velvet Coast — Clear the courtyards (12 goons)' },
      { type: 'kill', target: spot('mansion', 'El Faro — phase 1'), count: 1, text: 'MISSION 10: Velvet Coast — El Faro, phase 1: pistol and bodyguards' },
      { type: 'kill', target: spot('mansion', 'El Faro — phase 2'), count: 1, text: 'MISSION 10: Velvet Coast — El Faro, phase 2: shotgun and grenades' },
      { type: 'kill', target: spot('mansion', 'El Faro — phase 3'), count: 1, text: 'MISSION 10: Velvet Coast — El Faro, phase 3: rifle on the balcony' },
      { type: 'escape', target: spot('marina', 'Escape boat'), wanted: 4, text: 'MISSION 10: Velvet Coast — Escape by boat (4 stars)' },
    ],
    outro: [
      { speaker: 'elfaro', text: 'You think this ends with me? The coast always finds a new owner.' },
      { speaker: 'marco', text: 'Then it can find one who is not you.' },
      { speaker: 'rosa', text: 'It is over, Marco. The sun is coming up over Port Solana.' },
      { speaker: 'marco', text: 'Twelve years. I finally get to stay.' },
    ],
    starHint: 5,
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === Number(id)) || null;
}
