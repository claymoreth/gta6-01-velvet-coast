// missionrunner.js — drives MISSIONS: intro dialogue, stage checks,
// rewards, auto-save. Every access to another system (combat, wanted,
// dialogue, HUD, markers) is defensive: if the system is not wired yet,
// the runner falls back to simple logic instead of crashing.
// Original code, written for this entry. No external assets.
import { MISSIONS, getMission } from './missiondata.js';
import { DialogueBox } from '../npc/dialogue.js';
import { MissionMarkers } from './markers.js';

const GOTO_RADIUS = 4;
const TALK_RADIUS = 3;
const CHASE_RADIUS = 5;

function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export class MissionRunner {
  constructor(ctx) {
    this.ctx = ctx;
    this.missionsDone = new Set();
    this.currentMission = null;
    this.stageIndex = 0;
    this.stageState = null; // {timer, kills, planted, followTime, choiceShown}
    this.dialogue = null;
    this.markers = null;
    this.pendingReward = false;
    if (!ctx.storyFlags) ctx.storyFlags = {};
  }

  ensureDialogue() {
    if (!this.dialogue) {
      try {
        this.dialogue = new DialogueBox(this.ctx);
        this.ctx.dialogue = this.dialogue;
      } catch {
        this.dialogue = null;
      }
    }
    return this.dialogue;
  }

  ensureMarkers() {
    if (this.markers) return this.markers;
    if (this.ctx.markers) {
      this.markers = this.ctx.markers;
      return this.markers;
    }
    try {
      this.markers = new MissionMarkers(this.ctx);
      this.ctx.markers = this.markers;
    } catch {
      this.markers = null;
    }
    return this.markers;
  }

  isActive() {
    return this.currentMission !== null;
  }

  startMission(id) {
    const mission = getMission(id);
    if (!mission) return false;
    if (this.isActive()) return false;
    this.currentMission = mission;
    this.stageIndex = 0;
    this.ctx.mission = mission.id;
    this.ctx.storyFlags[`mission${mission.id}Started`] = true;
    const dlg = this.ensureDialogue();
    if (dlg && mission.intro && mission.intro.length) {
      dlg.startDialogue(mission.intro, () => this.enterStage(0));
    } else {
      this.enterStage(0);
    }
    return true;
  }

  enterStage(index) {
    this.stageIndex = index;
    const stage = this.currentStage();
    this.stageState = { timer: 0, kills: 0, planted: 0, followTime: 0, choiceShown: false };
    if (!stage) {
      this.completeMission();
      return;
    }
    const markers = this.ensureMarkers();
    if (markers && stage.target) {
      markers.setTarget(stage.target.x, stage.target.z, stage.target.label || stage.text);
    }
    // Wanted level for escape / heat stages (defensive: plain number).
    if (typeof stage.wanted === 'number') {
      this.ctx.wanted = stage.wanted;
    }
    // Talk stages: spawn a named NPC at the target if the system exists.
    if (stage.type === 'talk' && this.ctx.pedestrians
      && typeof this.ctx.pedestrians.spawnMissionNPC === 'function') {
      try {
        const giver = this.currentMission.giver || 'rosa';
        const npc = this.ctx.pedestrians.spawnMissionNPC(giver, stage.target.x, stage.target.z);
        this.ctx.missionNPC = npc;
      } catch {
        this.ctx.missionNPC = null;
      }
    }
    // Survive stages: reset the combat wave counter if combat exists.
    if (stage.type === 'survive' && this.ctx.combat
      && typeof this.ctx.combat.startWaves === 'function') {
      try {
        this.ctx.combat.startWaves(stage.count || 3);
      } catch { /* fallback: timer-based survival below */ }
    }
  }

  currentStage() {
    if (!this.currentMission) return null;
    return this.currentMission.stages[this.stageIndex] || null;
  }

  currentObjectiveText() {
    const stage = this.currentStage();
    if (stage) return stage.text || this.currentMission.title;
    if (this.currentMission) return this.currentMission.title;
    return '';
  }

  // Combat systems report kills here; also polled from ctx.combat in update().
  registerKill(n = 1) {
    if (!this.stageState) return;
    this.stageState.kills += n;
  }

  playerPos() {
    const p = this.ctx.player;
    return p ? p.pos : null;
  }

  update(dt) {
    if (this.dialogue) this.dialogue.update(dt);
    if (this.markers) this.markers.update(dt);
    if (!this.isActive()) return;
    // While a dialogue is open the game is paused; stages wait.
    if (this.ctx.dialogOpen) return;
    const stage = this.currentStage();
    if (!stage) return;
    const pos = this.playerPos();
    if (!pos) return;
    const st = this.stageState;
    st.timer += dt;

    switch (stage.type) {
      case 'goto': {
        if (stage.target && dist2d(pos, stage.target) <= GOTO_RADIUS) this.advanceStage();
        break;
      }
      case 'talk': {
        const npcPos = this.ctx.missionNPC?.pos || stage.target;
        const near = npcPos && dist2d(pos, npcPos) <= TALK_RADIUS;
        const pressed = this.ctx.input && this.ctx.input.consumePressed
          ? this.ctx.input.consumePressed('KeyE') : false;
        if (near && pressed) this.advanceStage();
        break;
      }
      case 'chase': {
        // Target is a vehicle/NPC position when the chase system exists;
        // otherwise the stage target point itself.
        const tp = this.ctx.chaseTarget?.pos || stage.target;
        if (tp && dist2d(pos, tp) <= CHASE_RADIUS) {
          // On-foot catch (mission 6, stage 2) or a ram (stage 1).
          this.advanceStage();
        }
        break;
      }
      case 'follow': {
        const tp = this.ctx.chaseTarget?.pos || stage.target;
        if (tp && dist2d(pos, tp) <= 45) {
          st.followTime += dt;
          if (st.followTime >= (stage.count || 20)) this.advanceStage();
        }
        break;
      }
      case 'steal': {
        // Steal completes once the player is driving (any vehicle near
        // the target counts when no vehicle system reports it).
        if (this.ctx.player.driving) this.advanceStage();
        break;
      }
      case 'deliver': {
        const driving = !!this.ctx.player.driving;
        const near = stage.target && dist2d(pos, stage.target) <= 6;
        if (stage.count && stage.count > 1) {
          // Multi-drop (mission 7 crates): each arrival plants one.
          if (near && !st._plantedHere) {
            st._plantedHere = true;
            st.planted += 1;
            this.toast(`Crate planted (${st.planted}/${stage.count})`);
          }
          if (!near) st._plantedHere = false;
          if (st.planted >= stage.count) this.advanceStage();
        } else if (near && driving) {
          this.advanceStage();
        } else if (near && !driving && stage.text && stage.text.includes('Crate')) {
          this.advanceStage();
        }
        break;
      }
      case 'kill': {
        const combatAlive = this.ctx.combat && typeof this.ctx.combat.aliveCount === 'number'
          ? this.ctx.combat.aliveCount
          : (this.ctx.combat && typeof this.ctx.combat.remaining === 'function'
            ? this.ctx.combat.remaining() : null);
        const need = stage.count || 1;
        if (combatAlive !== null && combatAlive !== undefined) {
          if (combatAlive <= 0) this.advanceStage();
        } else if (st.kills >= need) {
          this.advanceStage();
        }
        break;
      }
      case 'survive': {
        const wavesDone = this.ctx.combat && typeof this.ctx.combat.wavesCleared === 'number'
          ? this.ctx.combat.wavesCleared : null;
        const need = stage.count || 3;
        if (wavesDone !== null) {
          if (wavesDone >= need) this.advanceStage();
        } else if (st.timer >= need * 20) {
          // Fallback: 20s per wave when no combat system reports waves.
          this.advanceStage();
        }
        break;
      }
      case 'escape': {
        const wanted = typeof this.ctx.wanted === 'number' ? this.ctx.wanted : 0;
        const policeNear = this.ctx.nearestPoliceDist;
        if (wanted <= 0) {
          this.advanceStage();
        } else if (typeof policeNear === 'number' && policeNear > 80) {
          this.advanceStage();
        } else if (st.timer > 90) {
          // Fallback so the stage can never soft-lock without police AI.
          this.advanceStage();
        }
        break;
      }
      case 'choice': {
        if (!st.choiceShown) {
          st.choiceShown = true;
          this.showChoice(stage);
        }
        break;
      }
      default:
        break;
    }
  }

  showChoice(stage) {
    const dlg = this.ensureDialogue();
    const options = stage.options || [
      { id: 'spare', label: 'Spare Dex' },
      { id: 'execute', label: 'Execute Dex' },
      { id: 'use', label: 'Use Dex' },
    ];
    const prompt = { speaker: 'dex', text: 'Whatever you choose, I will not run. Decide what I am to you.' };
    if (dlg && typeof dlg.showChoice === 'function') {
      dlg.showChoice(prompt, options, (id) => this.resolveChoice(id || 'spare'));
    } else {
      // No choice UI wired yet: default to spare, never soft-lock.
      this.resolveChoice('spare');
    }
  }

  resolveChoice(id) {
    this.ctx.storyFlags.dexFate = id;
    this.ctx.storyFlags[`mission9_${id}`] = true;
    this.advanceStage();
  }

  advanceStage() {
    if (!this.isActive()) return;
    this.stageIndex += 1;
    if (this.stageIndex >= this.currentMission.stages.length) {
      this.completeMission();
    } else {
      this.enterStage(this.stageIndex);
    }
  }

  toast(msg) {
    if (this.ctx.notifications && typeof this.ctx.notifications.show === 'function') {
      try {
        this.ctx.notifications.show(msg);
      } catch { /* toast is best-effort */ }
    }
  }

  completeMission() {
    const mission = this.currentMission;
    if (!mission) return;
    const finish = () => {
      if (this.ctx.player && typeof this.ctx.player.cash === 'number') {
        this.ctx.player.cash += mission.reward || 0;
      }
      this.missionsDone.add(mission.id);
      this.ctx.storyFlags[`mission${mission.id}Done`] = true;
      this.toast(`Mission complete: ${mission.title} — $${mission.reward}`);
      const markers = this.markers;
      if (markers) markers.clear();
      this.currentMission = null;
      this.stageIndex = 0;
      this.stageState = null;
      this.ctx.mission = this.missionsDone.size;
      if (this.ctx.save && typeof this.ctx.save.saveGame === 'function') {
        try {
          const p = this.ctx.player ? this.ctx.player.pos : null;
          this.ctx.save.saveGame({
            position: p ? { x: p.x, y: p.y, z: p.z } : null,
            cash: this.ctx.player ? this.ctx.player.cash : 0,
            mission: this.ctx.mission,
            hour: this.ctx.time ? this.ctx.time.hour : 10,
          });
        } catch { /* save is best-effort */ }
      }
    };
    const dlg = this.ensureDialogue();
    if (dlg && mission.outro && mission.outro.length) {
      dlg.startDialogue(mission.outro, finish);
    } else {
      finish();
    }
  }
}
