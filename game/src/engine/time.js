// time.js — TimeOfDay: a full 24h cycle lasts 6 real minutes.
// Original code, written for this entry.

export class TimeOfDay {
  constructor(hour = 10) {
    this.hour = hour;
  }

  advance(dt) {
    // 24 hours per 360 seconds -> 1 real second = 0.0667 game-hours.
    this.hour = (this.hour + (dt * 24) / 360) % 24;
  }

  // 0 at 06:00 (sunrise), PI at 18:00 (sunset), 2PI at next sunrise.
  sunAngle() {
    return ((this.hour - 6) / 12) * Math.PI;
  }

  isNight() {
    return this.hour < 6 || this.hour >= 18;
  }

  // Golden hour: late-afternoon light, 16:30–18:30 (Wave 11A).
  isGoldenHour() {
    return this.hour >= 16.5 && this.hour < 18.5;
  }

  // Sun height above the horizon, -1 (midnight) .. 1 (noon) (Wave 11A).
  sunElevation() {
    return Math.sin(this.sunAngle());
  }

  // 0 = full night, 1 = full day; smooth ramp around dawn/dusk.
  dayFactor() {
    const elev = Math.sin(this.sunAngle());
    const t = (elev + 0.05) / 0.3;
    return Math.max(0, Math.min(1, t));
  }
}
