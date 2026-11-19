import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startDevServer } from '../server/dev-server.mjs';
import { MultiplayerClient, STATUS } from '../src/game/multiplayer/client.js';
import { CLOSE, MAX_PLAYERS } from '../src/game/multiplayer/protocol.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, ms = 3000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (check()) return;
        await wait(20);
    }
    throw new Error('timed out');
}

function makeClient(url, nick, character = 'boy') {
    const client = new MultiplayerClient({ url, nick, character, WebSocketImpl: WebSocket });
    client.log = { joined: [], left: [], snaps: [], emotes: [] };
    client.onJoin = (player, all) => { if (player) client.log.joined.push(player); else client.log.all = all; };
    client.onLeave = (id) => client.log.left.push(id);
    client.onSnap = (list) => client.log.snaps.push(...list.map((p) => ({ ...p })));
    client.onEmote = (id, e) => client.log.emotes.push([id, e]);
    return client;
}

test('two clients see each other walk, emote and leave through the real server', async () => {
    const server = await startDevServer({ port: 0, log: () => {} });
    const url = `ws://localhost:${server.port}/join`;
    try {
        const a = makeClient(url, 'Brave Parrot 7', 'boy');
        const b = makeClient(url, 'Kind Tiger 9', 'girl');
        a.connect();
        await until(() => a.isOnline);
        b.connect();
        await until(() => b.isOnline);

        assert.equal(b.log.all.length, 1);
        assert.equal(b.log.all[0].nick, 'Brave Parrot 7');
        await until(() => a.log.joined.length === 1);
        assert.equal(a.log.joined[0].ch, 'girl');

        a.update(1000, { x: 10, y: 0.5, z: -20, yaw: 1, a: 'run' });
        await until(() => b.log.snaps.length > 0);
        const seen = b.log.snaps.at(-1);
        assert.equal(seen.x, 10);
        assert.equal(seen.z, -20);
        assert.equal(seen.a, 'run');

        a.sendEmote('heart');
        await until(() => b.log.emotes.length > 0);
        assert.deepEqual(b.log.emotes[0], [a.selfId, 'heart']);

        a.close();
        await until(() => b.log.left.length > 0);
        assert.equal(b.players.size, 0);
        b.close();
    } finally {
        await server.close();
    }
});

test('the 13th player is told the room is full by the next room, not refused', async () => {
    const server = await startDevServer({ port: 0, log: () => {} });
    const url = `ws://localhost:${server.port}/join`;
    const clients = [];
    try {
        for (let i = 0; i < MAX_PLAYERS + 1; i += 1) {
            const client = makeClient(url, `Happy Owl ${i + 1}`);
            clients.push(client);
            client.connect();
            await until(() => client.isOnline);
        }
        const rooms = new Set(clients.map((client) => client.room));
        assert.deepEqual([...rooms].sort(), ['zoo-1', 'zoo-2']);
        assert.equal(clients.filter((client) => client.room === 'zoo-1').length, MAX_PLAYERS);
    } finally {
        clients.forEach((client) => client.close());
        await server.close();
    }
});

test('a client that sends a bad nickname is refused and does not retry', async () => {
    const server = await startDevServer({ port: 0, log: () => {} });
    const url = `ws://localhost:${server.port}/join`;
    try {
        const client = makeClient(url, 'Maria Santos');
        client.connect();
        await until(() => client.status === STATUS.ERROR);
        assert.equal(server.rooms.get('zoo-1').size, 0);
    } finally {
        await server.close();
    }
});

test('a dead server gives an error status instead of a crash', async () => {
    const client = new MultiplayerClient({ url: 'ws://localhost:1/join', nick: 'Brave Parrot 7', character: 'boy', WebSocketImpl: WebSocket, setTimeoutImpl: (fn) => setTimeout(fn, 5) });
    client.connect();
    await until(() => client.status === STATUS.ERROR, 5000);
    assert.equal(client.isOnline, false);
    assert.ok(CLOSE.FULL);
});
