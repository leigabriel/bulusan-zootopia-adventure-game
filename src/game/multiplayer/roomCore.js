import {
    ACTIONS, CHARACTERS, CLOSE, EMOTE_COOLDOWN_MS, HEIGHT_MAX, HEIGHT_MIN, IDLE_TIMEOUT_MS,
    MAX_MESSAGE_BYTES, MAX_PLAYERS, PROTOCOL_VERSION, REPORTS_TO_KICK, WORLD_LIMIT,
    isValidEmote, isValidNickname,
} from './protocol.js';

// All the rules of one zoo room, with no network code in it. A Cloudflare
// Durable Object and a plain Node test server both call into this, so what is
// tested here is what runs live.
//
// Every method returns a list of "outputs" for the caller to deliver:
//   { to: connId, data }                 send to one connection
//   { broadcast: true, except?: connId, data }   send to every joined player
//   { close: connId, code, reason }      close a connection

const STATE_MIN_GAP_MS = 40;     // faster than this is dropped
const MAX_BAD_MESSAGES = 20;

const round = (value, places = 2) => {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function json(message) {
    return JSON.stringify(message);
}

export class RoomCore {
    constructor({ name = 'zoo-1', maxPlayers = MAX_PLAYERS, now = () => Date.now(), log = () => {} } = {}) {
        this.name = name;
        this.maxPlayers = maxPlayers;
        this.now = now;
        this.log = log;
        this.players = new Map();   // connId -> player
        this.pending = new Set();   // connected but not yet said hello
        this.nextId = 1;
    }

    get size() {
        return this.players.size;
    }

    get isFull() {
        return this.players.size + this.pending.size >= this.maxPlayers;
    }

    get isEmpty() {
        return this.players.size === 0 && this.pending.size === 0;
    }

    connect(connId) {
        if (this.isFull) {
            return [{ close: connId, code: CLOSE.FULL, reason: 'full' }];
        }
        this.pending.add(connId);
        return [];
    }

    receive(connId, raw) {
        const player = this.players.get(connId);
        if (!player && !this.pending.has(connId)) return [];

        if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) {
            return this.bad(connId, player);
        }
        let message;
        try {
            message = JSON.parse(raw);
        } catch {
            return this.bad(connId, player);
        }
        if (!message || typeof message !== 'object' || typeof message.t !== 'string') {
            return this.bad(connId, player);
        }

        if (!player) {
            return message.t === 'hello' ? this.hello(connId, message) : this.bad(connId, null);
        }

        player.lastSeen = this.now();
        switch (message.t) {
            case 's': return this.state(player, message);
            case 'e': return this.emote(player, message);
            case 'r': return this.report(player, message);
            case 'p': return [{ to: connId, data: json({ t: 'pong' }) }];
            default: return this.bad(connId, player);
        }
    }

    hello(connId, message) {
        if (message.v !== PROTOCOL_VERSION) {
            this.pending.delete(connId);
            return [{ close: connId, code: CLOSE.VERSION, reason: 'version' }];
        }
        if (!isValidNickname(message.nick) || !CHARACTERS.includes(message.ch)) {
            this.pending.delete(connId);
            return [{ close: connId, code: CLOSE.BAD_HELLO, reason: 'bad hello' }];
        }
        this.pending.delete(connId);

        const id = this.nextId++;
        const player = {
            id, connId, nick: message.nick, ch: message.ch,
            x: 0, y: 0, z: 0, yaw: 0, a: 'idle',
            dirty: false, lastState: 0, lastEmote: 0, lastSeen: this.now(),
            bad: 0, reportedBy: new Set(),
        };
        this.players.set(connId, player);

        const others = [...this.players.values()].filter((other) => other !== player).map((other) => this.describe(other));
        return [
            { to: connId, data: json({ t: 'welcome', id, room: this.name, players: others }) },
            { broadcast: true, except: connId, data: json({ t: 'join', p: this.describe(player) }) },
        ];
    }

    describe(player) {
        return { id: player.id, nick: player.nick, ch: player.ch, x: player.x, y: player.y, z: player.z, yaw: player.yaw, a: player.a };
    }

    state(player, message) {
        const at = this.now();
        if (at - player.lastState < STATE_MIN_GAP_MS) return [];
        const { x, y, z, yaw, a } = message;
        if (![x, y, z, yaw].every(Number.isFinite) || !ACTIONS.includes(a)) {
            return this.bad(player.connId, player);
        }
        player.lastState = at;
        player.x = round(clamp(x, -WORLD_LIMIT, WORLD_LIMIT));
        player.y = round(clamp(y, HEIGHT_MIN, HEIGHT_MAX));
        player.z = round(clamp(z, -WORLD_LIMIT, WORLD_LIMIT));
        player.yaw = round(((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, 3);
        player.a = a;
        player.dirty = true;
        return [];
    }

    emote(player, message) {
        const at = this.now();
        if (!isValidEmote(message.id)) return this.bad(player.connId, player);
        if (at - player.lastEmote < EMOTE_COOLDOWN_MS) return [];
        player.lastEmote = at;
        return [{ broadcast: true, data: json({ t: 'emote', id: player.id, e: message.id }) }];
    }

    report(player, message) {
        const target = [...this.players.values()].find((other) => other.id === message.pid);
        if (!target || target === player) return [];
        target.reportedBy.add(player.id);
        this.log(`report: ${player.nick} reported ${target.nick} (${target.reportedBy.size})`);
        if (target.reportedBy.size >= REPORTS_TO_KICK) {
            return [{ close: target.connId, code: CLOSE.KICKED, reason: 'reported' }];
        }
        return [];
    }

    bad(connId, player) {
        if (!player) {
            this.pending.delete(connId);
            return [{ close: connId, code: CLOSE.BAD_HELLO, reason: 'bad first message' }];
        }
        player.bad += 1;
        if (player.bad >= MAX_BAD_MESSAGES) {
            return [{ close: connId, code: CLOSE.TOO_MANY_ERRORS, reason: 'too many errors' }];
        }
        return [];
    }

    disconnect(connId) {
        this.pending.delete(connId);
        const player = this.players.get(connId);
        if (!player) return [];
        this.players.delete(connId);
        return [{ broadcast: true, data: json({ t: 'leave', id: player.id }) }];
    }

    // Called about ten times a second: sends what moved and drops silent players.
    tick() {
        const outputs = [];
        const at = this.now();

        for (const player of [...this.players.values()]) {
            if (at - player.lastSeen > IDLE_TIMEOUT_MS) {
                outputs.push({ close: player.connId, code: CLOSE.IDLE, reason: 'idle' });
            }
        }

        const moved = [...this.players.values()].filter((player) => player.dirty);
        if (moved.length > 0) {
            const rows = moved.map((player) => [player.id, player.x, player.y, player.z, player.yaw, ACTIONS.indexOf(player.a)]);
            moved.forEach((player) => { player.dirty = false; });
            outputs.push({ broadcast: true, data: json({ t: 'snap', p: rows }) });
        }
        return outputs;
    }
}
