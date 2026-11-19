import { MultiplayerClient, STATUS } from './client.js';
import { GhostPlayers } from './ghosts.js';

// Joins the game scene and the room server. The game calls `tick` every frame;
// the menu and HUD listen through `onChange`.
export class TogetherSession {
    constructor({ scene, url, nick, character, getLanguage, onChange = () => {}, WebSocketImpl }) {
        this.onChange = onChange;
        this.reported = new Set();
        this.ghosts = new GhostPlayers(scene, { getLanguage });
        this.client = new MultiplayerClient({ url, nick, character, WebSocketImpl });

        this.client.onStatus = () => this.notify();
        this.client.onJoin = (player, all) => {
            (all || [player]).forEach((p) => this.ghosts.add(p));
            this.notify();
        };
        this.client.onLeave = (id) => {
            this.ghosts.remove(id);
            this.notify();
        };
        this.client.onSnap = (list) => this.ghosts.setTargets(list);
        this.client.onEmote = (id, emoteId) => {
            if (id === this.client.selfId) return;
            if (this.ghosts.isMuted(id)) return;
            this.ghosts.showEmote(id, emoteId, performance.now() / 1000);
        };
    }

    start() { this.client.connect(); }

    get status() { return this.client.status; }

    snapshot() {
        return {
            status: this.client.status,
            room: this.client.room,
            players: [...this.client.players.values()].map((p) => ({
                id: p.id,
                nick: p.nick,
                character: p.ch,
                muted: this.ghosts.isMuted(p.id),
                reported: this.reported.has(p.id),
            })),
        };
    }

    notify() { this.onChange(this.snapshot()); }

    // feet = { x, y, z } of the local player's feet, yaw as the game uses it.
    tick(nowMs, dt, feet, yaw, action) {
        this.client.update(nowMs, { x: feet.x, y: feet.y, z: feet.z, yaw, a: action });
        this.ghosts.update(dt, nowMs / 1000, feet);
    }

    sendEmote(id) {
        if (!this.client.isOnline) return false;
        if (!this.client.sendEmote(id)) return false;
        this.ghosts.showLocalEmote(id, performance.now() / 1000);
        return true;
    }

    toggleMute(id) {
        this.ghosts.setMuted(id, !this.ghosts.isMuted(id));
        this.notify();
    }

    // A report also hides that player for this child straight away.
    report(id) {
        if (this.reported.has(id)) return;
        this.reported.add(id);
        this.client.report(id);
        this.ghosts.setMuted(id, true);
        this.notify();
    }

    stop() {
        this.client.onStatus = () => {};
        this.client.close();
        this.ghosts.dispose();
    }
}

export { STATUS };
