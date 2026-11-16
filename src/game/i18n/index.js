import { useSyncExternalStore } from 'react';
import TAGALOG from './tagalog.js';

// The game is written in plain English. Every line the player can read goes
// through t(); Tagalog is looked up by the English line. A line with no Tagalog
// entry simply shows in English, so a missing word never breaks the game.

export const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'tl', label: 'Tagalog' },
];

const SETTINGS_KEY = 'minizoo_settings';
const DICTIONARIES = { en: null, tl: TAGALOG };
const listeners = new Set();

export function normalizeLanguage(value) {
    return value === 'tl' ? 'tl' : 'en';
}

// Filipino and Tagalog browsers start in Tagalog; everyone else starts in English.
export function detectLanguage(navigatorLike = typeof navigator !== 'undefined' ? navigator : null) {
    const tag = String(navigatorLike?.language || '').toLowerCase();
    return tag.startsWith('tl') || tag.startsWith('fil') ? 'tl' : 'en';
}

function readStoredLanguage() {
    try {
        const stored = JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY) || 'null');
        if (stored && (stored.language === 'en' || stored.language === 'tl')) return stored.language;
    } catch {
        // Storage can be unavailable; fall back to the browser language.
    }
    return detectLanguage();
}

let currentLanguage = readStoredLanguage();

export function getLanguage() {
    return currentLanguage;
}

export function setLanguage(language) {
    const next = normalizeLanguage(language);
    if (next === currentLanguage) return;
    currentLanguage = next;
    if (typeof document !== 'undefined') document.documentElement.lang = next === 'tl' ? 'fil' : 'en';
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function fill(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key])));
}

// Translate an English line. {name} style placeholders are filled from `vars`.
export function t(text, vars, language = currentLanguage) {
    if (typeof text !== 'string' || text === '') return text;
    const dictionary = DICTIONARIES[language];
    const translated = dictionary && Object.hasOwn(dictionary, text) ? dictionary[text] : text;
    return fill(translated, vars);
}

// Re-render the calling component whenever the language changes.
export function useLanguage() {
    return useSyncExternalStore(subscribe, getLanguage, () => 'en');
}

export function hasTranslation(text) {
    return Object.hasOwn(TAGALOG, text);
}
