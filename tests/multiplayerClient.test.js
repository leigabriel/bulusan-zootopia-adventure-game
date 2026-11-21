import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startDevServer } from '../server/dev-server.mjs';
import { MultiplayerClient, STATUS } from '../src/game/multiplayer/client.js';
import { CLOSE, MAX_PLAYERS, isValidRoomCode, roomCodeFromName } from '../src/game/multiplayer/protocol.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, ms = 3000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (check()) return;
        await wait(20);
    }
    throw new Error('timed out');
}

function makeClient(url, nick, character = 'boy', extra = {}) {
    const client = new MultiplayerClient({ url, nick, character, WebSocketImpl: WebSocket, ...extra });
    client.log = { joined: [], left: [], snaps: [], emotes: [] };
    client.onJoin = (player, all) => { if (player) client.log.joined.push(player); else client.log.all = all; };
    client.onLeave = (id) => client.log.left.push(id);
    client.onSnap = (list) => client.log.snaps.push(...list.map((p) => ({ ...p })));
    client.onEmote = (id, e) => client.log.emotes.push([id, e]);
    client.log.chats = [];
    client.log.refused = [];
    client.onChat = (id, m) => client.log.chats.push([id, m]);
    client.onChatRefused = (r) => client.log.refused.push(r);
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
        const client = makeClient(url, 'Fuck Tiger 7');
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

// Browsers throw "Illegal invocation" when a timer is called as a method of
// another object, which the default setTimeout implementation used to do.
test('reconnect timers are called on the global object, like a browser', () => {
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = function (fn, ms) {
        if (this !== globalThis) throw new TypeError('Illegal invocation');
        return realSetTimeout(fn, ms);
    };
    globalThis.clearTimeout = function (id) {
        if (this !== globalThis) throw new TypeError('Illegal invocation');
        return realClearTimeout(id);
    };
    try {
        const client = new MultiplayerClient({ url: 'ws://localhost:1/join', nick: 'Brave Parrot 7', character: 'boy', WebSocketImpl: WebSocket });
        client.handleClose(1006);
        assert.equal(client.status, STATUS.CONNECTING);
        assert.equal(client.retry, 1);
        client.close();
        assert.equal(client.status, STATUS.IDLE);
    } finally {
        globalThis.setTimeout = realSetTimeout;
        globalThis.clearTimeout = realClearTimeout;
    }
});

test('create a private room, join it with the code, chat inside it', async () => {
    const server = await startDevServer({ port: 0, log: () => {} });
    const url = `ws://localhost:${server.port}/join`;
    try {
        const host = makeClient(url, 'Brave Parrot 7', 'boy', { mode: 'create' });
        host.connect();
        await until(() => host.isOnline);
        const code = roomCodeFromName(host.room);
        assert.ok(isValidRoomCode(code), host.room);

        const friend = makeClient(url, 'Lei Gab', 'girl', { mode: 'join', code });
        friend.connect();
        await until(() => friend.isOnline);
        assert.equal(friend.room, host.room);

        // A public player does not land in the private room.
        const stranger = makeClient(url, 'Kind Tiger 9');
        stranger.connect();
        await until(() => stranger.isOnline);
        assert.equal(stranger.room, 'zoo-1');

        host.sendChat('Hi Lei!');
        await until(() => friend.log.chats.length > 0);
        assert.deepEqual(friend.log.chats[0], [host.selfId, 'Hi Lei!']);
        assert.equal(stranger.log.chats.length, 0);

        friend.sendChat('you are dumb');
        await until(() => friend.log.refused.length > 0);
        assert.equal(friend.log.refused[0], 'blocked');
        assert.equal(host.log.chats.length, 1);
        [host, friend, stranger].forEach((client) => client.close());
    } finally {
        await server.close();
    }
});

test('joining a code nobody is using says not found and does not retry', async () => {
    const server = await startDevServer({ port: 0, log: () => {} });
    const url = `ws://localhost:${server.port}/join`;
    try {
        const client = makeClient(url, 'Brave Parrot 7', 'boy', { mode: 'join', code: 'K7M2' });
        client.connect();
        await until(() => client.status === STATUS.NOT_FOUND);
        assert.equal(client.isOnline, false);
    } finally {
        await server.close();
    }
});

test('two new private rooms get different codes', async () => {
    const server = await startDevServer({ port: 0, log: () => {} });
    const url = `ws://localhost:${server.port}/join`;
    try {
        const a = makeClient(url, 'Brave Parrot 7', 'boy', { mode: 'create' });
        const b = makeClient(url, 'Kind Tiger 9', 'girl', { mode: 'create' });
        a.connect();
        await until(() => a.isOnline);
        b.connect();
        await until(() => b.isOnline);
        assert.notEqual(a.room, b.room);
        a.close();
        b.close();
    } finally {
        await server.close();
    }
});
