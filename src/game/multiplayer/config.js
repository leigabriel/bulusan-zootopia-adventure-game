import { makeNickname, isValidNickname } from './protocol.js';

// Where the room server lives. Order: ?mp= address saved on this device,
// then VITE_MULTIPLAYER_URL from the build, then the zoo's own server below.
// The web game and the Android app use the same address, so they share rooms.
// For testing, open the game with ?mp=ws://localhost:8787/join once; it is
// remembered on that device. ?mp=off turns Play Together off on that device,
// ?mp=default goes back to the normal server.
export const DEFAULT_MULTIPLAYER_URL = 'wss://bulusan-zoo-rooms.bulusan-zootopia-adventure-game-room.workers.dev/join';
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
        if (param === 'off') writeStorage(URL_KEY, 'off');
        else if (param === 'default') writeStorage(URL_KEY, '');
        else if (/^wss?:\/\//.test(param || '')) writeStorage(URL_KEY, param);
    } catch { /* not in a browser */ }
    const saved = readStorage(URL_KEY);
    if (saved === 'off') return '';
    return saved || import.meta.env?.VITE_MULTIPLAYER_URL || DEFAULT_MULTIPLAYER_URL;
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
