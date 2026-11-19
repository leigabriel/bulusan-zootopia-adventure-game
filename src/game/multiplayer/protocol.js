// Shared by the game and by the room server, so both sides agree on what is
// allowed. Nothing in here touches the browser or Three.js.

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

// Players never type a name. A nickname is always built from these lists, so
// there is nothing to filter and no real name can ever appear.
export const NICK_ADJECTIVES = [
    'Brave', 'Happy', 'Kind', 'Swift', 'Sunny', 'Gentle', 'Clever', 'Jolly', 'Lucky', 'Merry',
    'Calm', 'Bright', 'Cheerful', 'Friendly', 'Playful', 'Proud',
];
export const NICK_ANIMALS = [
    'Parrot', 'Rabbit', 'Alpaca', 'Tiger', 'Owl', 'Frog', 'Goat', 'Koi', 'Pigeon', 'Deer', 'Monkey', 'Horse',
    'Ostrich', 'Donkey', 'Cow', 'Bull',
];
const NICK_PATTERN = new RegExp(`^(${NICK_ADJECTIVES.join('|')}) (${NICK_ANIMALS.join('|')}) ([1-9][0-9]?)$`);

export function isValidNickname(value) {
    return typeof value === 'string' && NICK_PATTERN.test(value);
}

export function makeNickname(random = Math.random) {
    const pick = (list) => list[Math.floor(random() * list.length) % list.length];
    return `${pick(NICK_ADJECTIVES)} ${pick(NICK_ANIMALS)} ${1 + Math.floor(random() * 99)}`;
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
};
