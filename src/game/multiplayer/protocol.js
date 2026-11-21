// Shared by the game and by the room server, so both sides agree on what is
// allowed. Nothing in here touches the browser or Three.js.

import { containsBlockedWord, looksLikeLinkOrContact } from './wordFilter.js';

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 12;
export const MAX_ROOMS = 20;

export const SEND_INTERVAL_MS = 100;       // how often a client may send its position
export const HEARTBEAT_MS = 2000;          // an idle client still speaks this often
export const SNAPSHOT_INTERVAL_MS = 100;   // how often the room sends changes
export const IDLE_TIMEOUT_MS = 8000;       // silent for this long means gone
export const EMOTE_COOLDOWN_MS = 1500;
export const MAX_MESSAGE_BYTES = 300;
export const REPORTS_TO_KICK = 3;

// The zoo is square; positions outside it are pulled back inside.
export const WORLD_LIMIT = 200;
export const HEIGHT_MIN = -5;
export const HEIGHT_MAX = 60;

export const ACTIONS = ['idle', 'run', 'jump'];
export const CHARACTERS = ['boy', 'girl'];

// Nicknames. The game suggests one from these lists ("Brave Parrot 24"), and a
// player may type their own. Both go through the same rules, so a typed name
// can not hold a bad word, a link, a phone number or an @ contact.
export const NICK_ADJECTIVES = [
    'Brave', 'Happy', 'Kind', 'Swift', 'Sunny', 'Gentle', 'Clever', 'Jolly', 'Lucky', 'Merry',
    'Calm', 'Bright', 'Cheerful', 'Friendly', 'Playful', 'Proud',
];
export const NICK_ANIMALS = [
    'Parrot', 'Rabbit', 'Alpaca', 'Tiger', 'Owl', 'Frog', 'Goat', 'Koi', 'Pigeon', 'Deer', 'Monkey', 'Horse',
    'Ostrich', 'Donkey', 'Cow', 'Bull',
];
export const NICK_MIN = 3;
export const NICK_MAX_TYPED = 16;
export const NICK_MAX = 20;
const NICK_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}]| (?! )|[._-](?![._-]))*[\p{L}\p{N}]$/u;

export function normalizeNickname(value) {
    return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

// Returns null when the nickname is fine, or the reason: short, long, chars, contact, blocked.
export function nicknameProblem(value) {
    if (typeof value !== 'string') return 'chars';
    if (value.length < NICK_MIN) return 'short';
    if (value.length > NICK_MAX) return 'long';
    if (!NICK_PATTERN.test(value)) return 'chars';
    if (looksLikeLinkOrContact(value)) return 'contact';
    if (containsBlockedWord(value)) return 'blocked';
    return null;
}

export function isValidNickname(value) {
    return typeof value === 'string' && value === normalizeNickname(value) && nicknameProblem(value) === null;
}

export function makeNickname(random = Math.random) {
    const pick = (list) => list[Math.floor(random() * list.length) % list.length];
    return `${pick(NICK_ADJECTIVES)} ${pick(NICK_ANIMALS)} ${1 + Math.floor(random() * 99)}`;
}

// Chat. Short messages, filtered by the room before anyone sees them.
export const MAX_CHAT_LENGTH = 60;
export const CHAT_COOLDOWN_MS = 1500;
const CHAT_PATTERN = /^[\p{L}\p{N}\p{M} .,!?'\u2019:;()~-]+$/u;

export function normalizeChat(value) {
    return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

// Returns null when the message may be sent, or the reason: empty, long, chars, contact, blocked.
export function chatProblem(value) {
    if (typeof value !== 'string' || value.length === 0) return 'empty';
    if (value.length > MAX_CHAT_LENGTH) return 'long';
    if (!CHAT_PATTERN.test(value)) return 'chars';
    if (looksLikeLinkOrContact(value)) return 'contact';
    if (containsBlockedWord(value)) return 'blocked';
    return null;
}

// Private rooms. A code is 4 characters with no vowels, so it can never spell
// a word, and no 0/1 that look like O/I.
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';
export const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function normalizeRoomCode(value) {
    return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(value) {
    return typeof value === 'string' && ROOM_CODE_PATTERN.test(value);
}

export function makeRoomCode(random = Math.random) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length];
    }
    return code;
}

export const PRIVATE_PREFIX = 'room-';

export function privateRoomName(code) {
    return `${PRIVATE_PREFIX}${code}`;
}

export function roomCodeFromName(name) {
    return typeof name === 'string' && name.startsWith(PRIVATE_PREFIX) ? name.slice(PRIVATE_PREFIX.length) : '';
}

// Fixed list of emotes. `en` and `tl` are what the speech bubble shows.
export const EMOTES = [
    { id: 'wave', en: 'Hi!', tl: 'Kumusta!' },
    { id: 'heart', en: 'Love', tl: 'Mahal' },
    { id: 'hello', en: 'Hello!', tl: 'Hello!' },
    { id: 'thanks', en: 'Thanks!', tl: 'Salamat!' },
    { id: 'clap', en: 'Yay!', tl: 'Yehey!' },
    { id: 'star', en: 'Wow!', tl: 'Wow!' },
];
const EMOTE_IDS = new Set(EMOTES.map((emote) => emote.id));

export function isValidEmote(id) {
    return typeof id === 'string' && EMOTE_IDS.has(id);
}

export function roomNameFor(index) {
    return `zoo-${index}`;
}

export const CLOSE = {
    FULL: 4001,
    BAD_HELLO: 4002,
    KICKED: 4003,
    TOO_MANY_ERRORS: 4004,
    IDLE: 4005,
    VERSION: 4006,
    NOT_FOUND: 4007,
};
