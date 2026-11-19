import {
    ACTIONS, CLOSE, HEARTBEAT_MS, PROTOCOL_VERSION, SEND_INTERVAL_MS,
} from './protocol.js';

export const STATUS = {
    IDLE: 'idle',
    CONNECTING: 'connecting',
    ONLINE: 'online',
    FULL: 'full',
    KICKED: 'kicked',
    ERROR: 'error',
};

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const NO_RETRY = new Set([CLOSE.FULL, CLOSE.BAD_HELLO, CLOSE.KICKED, CLOSE.TOO_MANY_ERRORS, CLOSE.VERSION]);

// One connection to a zoo room. It keeps the list of other players, sends the
// local player's position about ten times a second and tells the game what
// happens through the `on*` callbacks. The game keeps working if it fails.
export class MultiplayerClient {
    constructor({ url, nick, character, WebSocketImpl = globalThis.WebSocket, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
        this.url = url;
        this.nick = nick;
        this.character = character;
        this.WebSocketImpl = WebSocketImpl;
        this.setTimeoutImpl = setTimeoutImpl;
        this.clearTimeoutImpl = clearTimeoutImpl;

        this.status = STATUS.IDLE;
        this.selfId = null;
        this.room = '';
        this.players = new Map();

        this.onStatus = () => {};
        this.onJoin = () => {};
        this.onLeave = () => {};
        this.onSnap = () => {};
        this.onEmote = () => {};

        this.socket = null;
        this.closedByUs = false;
        this.retry = 0;
        this.retryTimer = null;
        this.lastSent = -Infinity;
        this.lastKey = '';
    }

    get isOnline() { return this.status === STATUS.ONLINE; }

    setStatus(status) {
        if (this.status === status) return;
        this.status = status;
        this.onStatus(status);
    }

    connect() {
        if (!this.url || !this.WebSocketImpl) {
            this.setStatus(STATUS.ERROR);
            return;
        }
        this.closedByUs = false;
        this.setStatus(STATUS.CONNECTING);

        let socket;
        try {
            socket = new this.WebSocketImpl(this.url);
        } catch {
            this.setStatus(STATUS.ERROR);
            return;
        }
        this.socket = socket;

        socket.onopen = () => {
            this.send({ t: 'hello', v: PROTOCOL_VERSION, nick: this.nick, ch: this.character });
        };
        socket.onmessage = (event) => this.handle(event.data);
        socket.onclose = (event) => this.handleClose(event.code);
        socket.onerror = () => { /* onclose follows */ };
    }

    handle(raw) {
        let message;
        try { message = JSON.parse(raw); } catch { return; }
        switch (message.t) {
            case 'welcome':
                this.selfId = message.id;
                this.room = message.room;
                this.retry = 0;
                this.players.clear();
                message.players.forEach((player) => this.players.set(player.id, player));
                this.setStatus(STATUS.ONLINE);
                this.onJoin(null, [...this.players.values()]);
                break;
            case 'join':
                this.players.set(message.p.id, message.p);
                this.onJoin(message.p);
                break;
            case 'leave':
                this.players.delete(message.id);
                this.onLeave(message.id);
                break;
            case 'snap': {
                const changed = [];
                for (const [id, x, y, z, yaw, action] of message.p) {
                    const player = this.players.get(id);
                    if (!player) continue;
                    Object.assign(player, { x, y, z, yaw, a: ACTIONS[action] || 'idle' });
                    changed.push(player);
                }
                if (changed.length > 0) this.onSnap(changed);
                break;
            }
            case 'emote':
                this.onEmote(message.id, message.e);
                break;
            default:
        }
    }

    handleClose(code) {
        const wasOnline = this.status === STATUS.ONLINE;
        const had = [...this.players.keys()];
        this.players.clear();
        this.selfId = null;
        this.socket = null;
        had.forEach((id) => this.onLeave(id));
        if (this.closedByUs) {
            this.setStatus(STATUS.IDLE);
            return;
        }
        if (code === CLOSE.FULL) { this.setStatus(STATUS.FULL); return; }
        if (code === CLOSE.KICKED) { this.setStatus(STATUS.KICKED); return; }
        if (NO_RETRY.has(code) || (!wasOnline && this.retry >= RETRY_DELAYS_MS.length)) {
            this.setStatus(STATUS.ERROR);
            return;
        }
        if (this.retry >= RETRY_DELAYS_MS.length) {
            this.setStatus(STATUS.ERROR);
            return;
        }
        const delay = RETRY_DELAYS_MS[this.retry];
        this.retry += 1;
        this.setStatus(STATUS.CONNECTING);
        this.retryTimer = this.setTimeoutImpl(() => this.connect(), delay);
    }

    send(message) {
        const socket = this.socket;
        if (!socket || socket.readyState !== 1) return false;
        try { socket.send(JSON.stringify(message)); return true; } catch { return false; }
    }

    // Call every frame with the local player's feet position. It only sends
    // when something changed, and at least once every couple of seconds.
    update(nowMs, state) {
        if (!this.isOnline) return;
        const gap = nowMs - this.lastSent;
        if (gap < SEND_INTERVAL_MS) return;
        const key = `${state.x.toFixed(2)}|${state.y.toFixed(2)}|${state.z.toFixed(2)}|${state.yaw.toFixed(2)}|${state.a}`;
        if (key === this.lastKey && gap < HEARTBEAT_MS) return;
        this.lastKey = key;
        this.lastSent = nowMs;
        this.send({ t: 's', x: state.x, y: state.y, z: state.z, yaw: state.yaw, a: state.a });
    }

    sendEmote(id) {
        return this.send({ t: 'e', id });
    }

    report(playerId) {
        return this.send({ t: 'r', pid: playerId });
    }

    close() {
        this.closedByUs = true;
        this.clearTimeoutImpl(this.retryTimer);
        try { this.socket?.close(1000, 'bye'); } catch { /* already closed */ }
        if (!this.socket) this.setStatus(STATUS.IDLE);
    }
}
