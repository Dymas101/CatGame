// Pure P1/P2 slot table. No browser or PeerJS dependencies, so it is testable
// in Node. Each slot keeps its token during a short reconnection grace period.
import { PLAYERS } from './config.js';

const SLOT_IDS = [1, 2, 3, 4];

export class SlotTable {
  constructor(graceMs = 12000) {
    this.graceMs = graceMs;
    this.slots = {
      1: { token: null, connected: false, pendingUntil: 0 },
      2: { token: null, connected: false, pendingUntil: 0 },
      3: { token: null, connected: false, pendingUntil: 0 },
      4: { token: null, connected: false, pendingUntil: 0 }
    };
  }

  /**
   * Claim a slot for a controller token.
   * @returns {{slot:number, reconnect:boolean, takeover:boolean, spectator?:boolean}}
   */
  claim(token, now = Date.now()) {
    token = String(token || '');
    if (!token) return { slot: 0, spectator: true, reconnect: false, takeover: false };

    for (const id of SLOT_IDS) {
      const slot = this.slots[id];
      if (slot.token === token) {
        const takeover = slot.connected;
        slot.connected = true;
        slot.pendingUntil = 0;
        return { slot: id, reconnect: true, takeover };
      }
    }

    for (const id of SLOT_IDS) {
      const slot = this.slots[id];
      const free = !slot.connected && (!slot.token || slot.pendingUntil <= now);
      if (free) {
        slot.token = token;
        slot.connected = true;
        slot.pendingUntil = 0;
        return { slot: id, reconnect: false, takeover: false };
      }
    }

    return { slot: 0, spectator: true, reconnect: false, takeover: false };
  }

  release(token, now = Date.now()) {
    for (const id of SLOT_IDS) {
      const slot = this.slots[id];
      if (slot.token !== token) continue;
      slot.connected = false;
      slot.pendingUntil = now + this.graceMs;
      return true;
    }
    return false;
  }

  /** Free slots whose grace period has elapsed. Returns true if anything changed. */
  expire(now = Date.now()) {
    let changed = false;
    for (const id of SLOT_IDS) {
      const slot = this.slots[id];
      if (slot.connected) continue;
      if (slot.token && slot.pendingUntil <= now) {
        slot.token = null;
        slot.pendingUntil = 0;
        changed = true;
      }
    }
    return changed;
  }

  presence(now = Date.now()) {
    return {
      players: SLOT_IDS.map((id) => {
        const slot = this.slots[id];
        const player = PLAYERS[id - 1];
        return {
          slot: id,
          name: player.name,
          color: player.fur,
          connected: slot.connected,
          pending: !slot.connected && slot.pendingUntil > now
        };
      }),
      connectedCount: SLOT_IDS.filter((id) => this.slots[id].connected).length
    };
  }

  slotMap(now = Date.now()) {
    const map = {};
    for (const id of SLOT_IDS) {
      const slot = this.slots[id];
      map[id] = {
        connected: slot.connected,
        pending: !slot.connected && slot.pendingUntil > now,
        name: PLAYERS[id - 1].name
      };
    }
    return map;
  }

  reset() {
    this.slots = {
      1: { token: null, connected: false, pendingUntil: 0 },
      2: { token: null, connected: false, pendingUntil: 0 },
      3: { token: null, connected: false, pendingUntil: 0 },
      4: { token: null, connected: false, pendingUntil: 0 }
    };
  }
}
