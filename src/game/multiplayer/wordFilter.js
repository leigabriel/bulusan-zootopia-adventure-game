// A small word filter for nicknames and chat, English and Tagalog. It is a
// demo-level safety net, not a full moderation system: it stops common bad
// words, spaced-out or number-swapped spellings, links and contact details.

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

// Blocked anywhere inside the text, even with spaces between letters.
const STRONG = [
    'fuck', 'shit', 'bitch', 'pussy', 'cunt', 'nigg', 'whore', 'slut', 'bastard', 'penis', 'vagina', 'porn',
    'asshole', 'dickhead', 'cocksuck', 'blowjob', 'rapist', 'nazi', 'hitler',
    'putang', 'tangina', 'tanginamo', 'pakyu', 'kantot', 'jakol', 'tarantado', 'pokpok', 'puking', 'bwisit', 'buwisit',
    'kupal', 'siraulo', 'gagu',
    // taking the chat somewhere else
    'facebook', 'messenger', 'tiktok', 'discord', 'instagram', 'whatsapp', 'telegram', 'viber', 'snapchat', 'gmail',
];

// Blocked only as a whole word, so words like "class" or "essex" stay fine.
const WORDS = new Set([
    'ass', 'dick', 'cock', 'sex', 'sexy', 'fag', 'rape', 'nude', 'naked', 'nsfw', 'kill', 'die', 'dead', 'suicide',
    'murder', 'gun', 'damn', 'crap', 'idiot', 'stupid', 'dumb', 'hell', 'wtf', 'omg',
    'gago', 'gaga', 'tanga', 'bobo', 'ulol', 'puta', 'tite', 'burat', 'leche', 'hayop', 'demonyo', 'lintik', 'pesteng',
    'inutil', 'engot', 'baliw', 'patay',
].filter((word) => word !== 'omg'));

function fold(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[0134578@$!|]/g, (char) => LEET[char]);
}

export function containsBlockedWord(text) {
    const folded = fold(text);
    const squashed = folded.replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
    const squashedKeepDouble = folded.replace(/[^a-z]/g, '');
    if (STRONG.some((word) => squashed.includes(word.replace(/(.)\1+/g, '$1')) || squashedKeepDouble.includes(word))) return true;
    const words = folded.split(/[^a-z]+/).filter(Boolean);
    return words.some((word) => WORDS.has(word) || WORDS.has(word.replace(/(.)\1+/g, '$1')));
}

const LINK = /(https?:|www\.|:\/\/|\.com|\.net|\.org|\.ph\b|\.gg\b|\.io\b|\.me\b|dot ?com)/i;

export function looksLikeLinkOrContact(text) {
    return LINK.test(String(text)) || /\d{5,}/.test(String(text).replace(/[\s.-]/g, ''));
}
