import { makeNickname, isValidNickname } from './protocol.js';

// Where the room server lives. Set VITE_MULTIPLAYER_URL when building
// (for example wss://bulusan-zoo-rooms.yourname.workers.dev/join).
// For testing, open the game with ?mp=ws://localhost:8787/join once; it is
// remembered on that device. ?mp=off forgets it.
const URL_KEY = 'minizoo_mp_url';
const NICK_KEY = 'minizoo_mp_nick';

function readStorage(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function writeStorage(key, value) {
    try {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
    } catch { /* private mode: nothing is remembered */ }
}

export function getMultiplayerUrl() {
    try {
        const param = new URLSearchParams(window.location.search).get('mp');
        if (param === 'off') writeStorage(URL_KEY, '');
        else if (/^wss?:\/\//.test(param || '')) writeStorage(URL_KEY, param);
    } catch { /* not in a browser */ }
    const fromEnv = import.meta.env?.VITE_MULTIPLAYER_URL || '';
    return readStorage(URL_KEY) || fromEnv;
}

export function isMultiplayerAvailable() {
    return Boolean(getMultiplayerUrl());
}

export function getSavedNickname() {
    const saved = readStorage(NICK_KEY);
    if (isValidNickname(saved)) return saved;
    const fresh = makeNickname();
    writeStorage(NICK_KEY, fresh);
    return fresh;
}

export function saveNickname(nick) {
    if (isValidNickname(nick)) writeStorage(NICK_KEY, nick);
}
