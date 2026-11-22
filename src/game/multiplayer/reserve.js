import { MultiplayerClient, STATUS } from './client.js';
import { roomCodeFromName } from './protocol.js';

const KEEP_ALIVE_MS = 3000; // the server drops a silent connection after 8 seconds
const GIVE_UP_MS = 15000;

// Makes a private room and holds it open, so the player can read the code and
// share it BEFORE the game starts. The room only exists while someone is in it,
// so this connection stays until the real session has joined; then release().
export function reserveRoom({ url, nick, character = 'boy', WebSocketImpl = globalThis.WebSocket, giveUpMs = GIVE_UP_MS, keepAliveMs = KEEP_ALIVE_MS } = {}) {
    return new Promise((resolve, reject) => {
        const client = new MultiplayerClient({ url, nick, character, mode: 'create', WebSocketImpl });
        let settled = false;
        let keepAlive = null;
        let giveUp = null;

        const release = () => {
            globalThis.clearInterval(keepAlive);
            globalThis.clearTimeout(giveUp);
            client.onStatus = () => {};
            client.close();
        };
        const fail = (status) => {
            if (settled) return;
            settled = true;
            release();
            reject(new Error(status));
        };

        client.onStatus = (status) => {
            if (settled) return;
            if (status === STATUS.ONLINE) {
                const code = roomCodeFromName(client.room);
                if (!code) { fail('error'); return; }
                settled = true;
                globalThis.clearTimeout(giveUp);
                keepAlive = globalThis.setInterval(() => client.send({ t: 'p' }), keepAliveMs);
                resolve({ code, release });
            } else if (status === STATUS.FULL || status === STATUS.NOT_FOUND || status === STATUS.KICKED || status === STATUS.ERROR) {
                fail(status);
            }
        };
        giveUp = globalThis.setTimeout(() => fail('error'), giveUpMs);
        client.connect();
    });
}
