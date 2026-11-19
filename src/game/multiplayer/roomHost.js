import { RoomCore } from './roomCore.js';
import { SNAPSHOT_INTERVAL_MS } from './protocol.js';

// Timers must be called on the global object: browsers and the Workers runtime
// reject `setInterval` when it is invoked as a method of another object.
const defaultTimers = {
    setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
    clearInterval: (id) => globalThis.clearInterval(id),
};

// Connects RoomCore to real sockets. A "socket" here is any object with
// send(text) and close(code, reason), so the same host runs inside a Cloudflare
// Durable Object, a Node `ws` server and the tests.
export class RoomHost {
    constructor({ name, now, log, timers = defaultTimers, maxPlayers } = {}) {
        this.core = new RoomCore({ name, now, log, maxPlayers });
        this.timers = timers;
        this.sockets = new Map();
        this.timer = null;
        this.nextConn = 1;
    }

    get size() { return this.core.size; }
    get isFull() { return this.core.isFull; }
    get isEmpty() { return this.core.isEmpty; }

    setName(name) {
        this.core.name = name;
    }

    open(socket) {
        const connId = `c${this.nextConn++}`;
        this.sockets.set(connId, socket);
        this.deliver(this.core.connect(connId));
        this.start();
        return connId;
    }

    message(connId, data) {
        this.deliver(this.core.receive(connId, data));
    }

    close(connId) {
        if (!this.sockets.delete(connId)) return;
        this.deliver(this.core.disconnect(connId));
        if (this.core.isEmpty) this.stop();
    }

    start() {
        if (this.timer) return;
        this.timer = this.timers.setInterval(() => this.deliver(this.core.tick()), SNAPSHOT_INTERVAL_MS);
    }

    stop() {
        if (!this.timer) return;
        this.timers.clearInterval(this.timer);
        this.timer = null;
    }

    deliver(outputs) {
        for (const output of outputs) {
            if (output.close) {
                const socket = this.sockets.get(output.close);
                try { socket?.close(output.code, output.reason); } catch { /* already closed */ }
                this.close(output.close);
            } else if (output.broadcast) {
                for (const connId of this.core.players.keys()) {
                    if (connId === output.except) continue;
                    try { this.sockets.get(connId)?.send(output.data); } catch { /* it will close soon */ }
                }
            } else if (output.to) {
                try { this.sockets.get(output.to)?.send(output.data); } catch { /* it will close soon */ }
            }
        }
    }
}
