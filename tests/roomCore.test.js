import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomCore } from '../src/game/multiplayer/roomCore.js';
import {
    CHAT_COOLDOWN_MS, CLOSE, EMOTES, EMOTE_COOLDOWN_MS, IDLE_TIMEOUT_MS, MAX_PLAYERS, PROTOCOL_VERSION,
    isValidEmote, isValidNickname, isValidRoomCode, makeNickname, makeRoomCode, normalizeRoomCode,
    privateRoomName, roomCodeFromName,
} from '../src/game/multiplayer/protocol.js';
import { containsBlockedWord } from '../src/game/multiplayer/wordFilter.js';

function makeRoom() {
    let time = 1000;
    const room = new RoomCore({ now: () => time });
    return { room, advance: (ms) => { time += ms; }, clock: () => time };
}

const hello = (nick = 'Brave Parrot 7', ch = 'boy') => JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, nick, ch });
const parse = (outputs) => outputs.filter((o) => o.data).map((o) => ({ ...o, msg: JSON.parse(o.data) }));

function join(room, connId, nick) {
    room.connect(connId);
    return parse(room.receive(connId, hello(nick)));
}

test('list nicknames and kind typed nicknames are valid', () => {
    assert.ok(isValidNickname('Brave Parrot 7'));
    assert.ok(isValidNickname(makeNickname()));
    for (let i = 0; i < 200; i += 1) assert.ok(isValidNickname(makeNickname()));
    assert.ok(isValidNickname('Lei Gab'));
    assert.equal(isValidNickname('fuck123'), false);
    assert.equal(isValidNickname('09171234567'), false);
    assert.equal(isValidNickname('me@mail'), false);
    assert.equal(isValidNickname('ab'), false);
    assert.equal(isValidNickname('  Lei Gab'), false);
    assert.equal(isValidNickname('<b>Brave</b> Parrot 7'), false);
    assert.equal(isValidNickname(null), false);
});

test('only listed emotes are valid', () => {
    EMOTES.forEach((emote) => assert.ok(isValidEmote(emote.id)));
    assert.equal(isValidEmote('hello world'), false);
    assert.equal(isValidEmote(undefined), false);
});

test('hello gives a welcome and tells others about the new player', () => {
    const { room } = makeRoom();
    const first = join(room, 'a', 'Brave Parrot 7');
    assert.equal(first[0].msg.t, 'welcome');
    assert.equal(first[0].msg.players.length, 0);

    const second = join(room, 'b', 'Kind Tiger 9');
    assert.equal(second[0].msg.players.length, 1);
    assert.equal(second[0].msg.players[0].nick, 'Brave Parrot 7');
    const joinMsg = second.find((o) => o.msg.t === 'join');
    assert.equal(joinMsg.except, 'b');
    assert.equal(joinMsg.msg.p.nick, 'Kind Tiger 9');
    assert.equal(room.size, 2);
});

test('a hello with a bad typed name is refused', () => {
    const { room } = makeRoom();
    room.connect('a');
    const out = room.receive('a', hello('Fuck Tiger 7'));
    assert.equal(out[0].close, 'a');
    assert.equal(out[0].code, CLOSE.BAD_HELLO);
    assert.equal(room.size, 0);
});

test('a wrong protocol version is refused', () => {
    const { room } = makeRoom();
    room.connect('a');
    const out = room.receive('a', JSON.stringify({ t: 'hello', v: 99, nick: 'Brave Parrot 7', ch: 'boy' }));
    assert.equal(out[0].code, CLOSE.VERSION);
});

test('anything before hello closes the connection', () => {
    const { room } = makeRoom();
    room.connect('a');
    const out = room.receive('a', JSON.stringify({ t: 's', x: 1, y: 0, z: 1, yaw: 0, a: 'idle' }));
    assert.equal(out[0].close, 'a');
});

test('room holds at most 12 players', () => {
    const { room } = makeRoom();
    for (let i = 0; i < MAX_PLAYERS; i += 1) join(room, `c${i}`, 'Happy Owl 3');
    assert.equal(room.isFull, true);
    const refused = room.connect('late');
    assert.equal(refused[0].code, CLOSE.FULL);
});

test('state is clamped into the zoo and sent in the next snapshot', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    join(room, 'b', 'Kind Tiger 9');
    advance(100);
    room.receive('a', JSON.stringify({ t: 's', x: 9999, y: 1.2345, z: -9999, yaw: 0.5, a: 'run' }));
    const snaps = parse(room.tick()).filter((o) => o.msg.t === 'snap');
    assert.equal(snaps.length, 1);
    const row = snaps[0].msg.p[0];
    assert.deepEqual(row.slice(1, 4), [200, 1.23, -200]);
    assert.equal(row[5], 1);
    // Nothing moved since, so nothing is sent.
    assert.equal(parse(room.tick()).filter((o) => o.msg.t === 'snap').length, 0);
});

test('riding action is accepted and sent in snapshots', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    join(room, 'b', 'Kind Tiger 9');
    advance(100);
    room.receive('a', JSON.stringify({ t: 's', x: 5, y: 0, z: 5, yaw: 1, a: 'ride' }));
    const snaps = parse(room.tick()).filter((o) => o.msg.t === 'snap');
    assert.equal(snaps.length, 1);
    assert.equal(snaps[0].msg.p[0][5], 3);
});

test('bad numbers in state are ignored and counted', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    advance(100);
    room.receive('a', JSON.stringify({ t: 's', x: 'a', y: 0, z: 0, yaw: 0, a: 'run' }));
    assert.equal(parse(room.tick()).length, 0);
});

test('state sent too fast is dropped', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    advance(100);
    room.receive('a', JSON.stringify({ t: 's', x: 1, y: 0, z: 1, yaw: 0, a: 'idle' }));
    room.receive('a', JSON.stringify({ t: 's', x: 50, y: 0, z: 50, yaw: 0, a: 'idle' }));
    const row = parse(room.tick()).find((o) => o.msg.t === 'snap').msg.p[0];
    assert.equal(row[1], 1);
});

test('emotes are broadcast, limited by cooldown and checked against the list', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    advance(2000);
    const first = parse(room.receive('a', JSON.stringify({ t: 'e', id: 'wave' })));
    assert.equal(first[0].msg.e, 'wave');
    assert.equal(parse(room.receive('a', JSON.stringify({ t: 'e', id: 'heart' }))).length, 0);
    advance(EMOTE_COOLDOWN_MS + 1);
    assert.equal(parse(room.receive('a', JSON.stringify({ t: 'e', id: 'heart' }))).length, 1);
    advance(EMOTE_COOLDOWN_MS + 1);
    assert.equal(parse(room.receive('a', JSON.stringify({ t: 'e', id: 'free text here' }))).length, 0);
});

test('leaving tells everyone and frees the seat', () => {
    const { room } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    join(room, 'b', 'Kind Tiger 9');
    const out = parse(room.disconnect('a'));
    assert.equal(out[0].msg.t, 'leave');
    assert.equal(room.size, 1);
    room.disconnect('b');
    assert.equal(room.isEmpty, true);
});

test('silent players are dropped after the idle timeout', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    advance(IDLE_TIMEOUT_MS + 1);
    const closes = room.tick().filter((o) => o.close);
    assert.equal(closes[0].close, 'a');
    assert.equal(closes[0].code, CLOSE.IDLE);
});

test('three different reports remove a player', () => {
    const { room } = makeRoom();
    const joined = ['a', 'b', 'c', 'd'].map((id, i) => join(room, id, `Happy Owl ${i + 1}`)[0].msg.id);
    const targetId = joined[3];
    room.receive('a', JSON.stringify({ t: 'r', pid: targetId }));
    room.receive('a', JSON.stringify({ t: 'r', pid: targetId }));
    room.receive('b', JSON.stringify({ t: 'r', pid: targetId }));
    const out = room.receive('c', JSON.stringify({ t: 'r', pid: targetId }));
    assert.equal(out[0].close, 'd');
    assert.equal(out[0].code, CLOSE.KICKED);
});

test('too many bad messages close the connection', () => {
    const { room } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    let last = [];
    for (let i = 0; i < 20; i += 1) last = room.receive('a', 'not json');
    assert.equal(last[0].code, CLOSE.TOO_MANY_ERRORS);
});

test('oversized messages are rejected', () => {
    const { room } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    const out = room.receive('a', JSON.stringify({ t: 'e', id: 'x'.repeat(500) }));
    assert.equal(out.length, 0);
});

test('ping gets a pong', () => {
    const { room } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    const out = parse(room.receive('a', JSON.stringify({ t: 'p' })));
    assert.equal(out[0].msg.t, 'pong');
});

test('chat reaches everyone, including the sender, after the checks', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    join(room, 'b', 'Kind Tiger 9');
    advance(2000);
    const out = parse(room.receive('a', JSON.stringify({ t: 'c', m: '  Hi   friends!  ' })));
    assert.equal(out.length, 1);
    assert.equal(out[0].broadcast, true);
    assert.deepEqual(out[0].msg, { t: 'chat', id: 1, m: 'Hi friends!' });
});

test('chat with a bad word, link or number is refused to the sender only', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    for (const [text, reason] of [['you are a b1tch', 'blocked'], ['see www.x.com', 'contact'], ['call 09171234567', 'contact'], ['<b>hi</b>', 'chars'], ['x'.repeat(61), 'long']]) {
        advance(2000);
        const out = parse(room.receive('a', JSON.stringify({ t: 'c', m: text })));
        assert.equal(out.length, 1, text);
        assert.equal(out[0].to, 'a');
        assert.deepEqual(out[0].msg, { t: 'chatno', r: reason });
    }
});

test('chat is rate limited', () => {
    const { room, advance } = makeRoom();
    join(room, 'a', 'Brave Parrot 7');
    advance(2000);
    assert.equal(parse(room.receive('a', JSON.stringify({ t: 'c', m: 'one' })))[0].msg.t, 'chat');
    advance(300);
    assert.deepEqual(parse(room.receive('a', JSON.stringify({ t: 'c', m: 'two' })))[0].msg, { t: 'chatno', r: 'slow' });
    advance(CHAT_COOLDOWN_MS);
    assert.equal(parse(room.receive('a', JSON.stringify({ t: 'c', m: 'three' })))[0].msg.t, 'chat');
});

test('room codes are 4 safe characters with no vowels', () => {
    for (let i = 0; i < 300; i += 1) {
        const code = makeRoomCode();
        assert.ok(isValidRoomCode(code), code);
        assert.equal(/[AEIOUY01]/.test(code), false, code);
    }
    assert.equal(normalizeRoomCode(' k7-m2x '), 'K7M2');
    assert.equal(isValidRoomCode('AB12'), false);
    assert.equal(roomCodeFromName(privateRoomName('K7M2')), 'K7M2');
    assert.equal(roomCodeFromName('zoo-1'), '');
});

test('the word filter catches spaced and number spellings but not normal words', () => {
    assert.equal(containsBlockedWord('f u c k'), true);
    assert.equal(containsBlockedWord('sh1t'), true);
    assert.equal(containsBlockedWord('ang bobo mo'), true);
    for (const fine of ['class', 'Sassy the tiger', 'I love the zoo', 'Assistant ranger', 'Hello po', 'Kumusta ka na?']) {
        assert.equal(containsBlockedWord(fine), false, fine);
    }
});
