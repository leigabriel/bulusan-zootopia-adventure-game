import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomHost } from '../src/game/multiplayer/roomHost.js';
import { CLOSE, PROTOCOL_VERSION } from '../src/game/multiplayer/protocol.js';

function fakeSocket() {
    return { sent: [], closed: null, send(text) { this.sent.push(JSON.parse(text)); }, close(code) { this.closed = code; } };
}

function fakeTimers() {
    const timers = { active: 0, fn: null, setInterval(fn) { timers.active += 1; timers.fn = fn; return 1; }, clearInterval() { timers.active -= 1; } };
    return timers;
}

const hello = (nick) => JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, nick, ch: 'boy' });

test('host welcomes, relays and stops its timer when empty', () => {
    const timers = fakeTimers();
    const host = new RoomHost({ name: 'zoo-1', timers });
    const a = fakeSocket();
    const b = fakeSocket();
    const ca = host.open(a);
    host.message(ca, hello('Brave Parrot 7'));
    assert.equal(a.sent[0].t, 'welcome');
    const cb = host.open(b);
    host.message(cb, hello('Kind Tiger 9'));
    assert.equal(a.sent.at(-1).t, 'join');
    assert.equal(timers.active, 1);

    host.close(ca);
    assert.equal(b.sent.at(-1).t, 'leave');
    host.close(cb);
    assert.equal(timers.active, 0);
    assert.equal(host.isEmpty, true);
});

test('host closes a socket that sends a bad hello', () => {
    const host = new RoomHost({ name: 'zoo-1', timers: fakeTimers() });
    const s = fakeSocket();
    const id = host.open(s);
    host.message(id, hello('Maria Santos'));
    assert.equal(s.closed, CLOSE.BAD_HELLO);
    assert.equal(host.size, 0);
});
