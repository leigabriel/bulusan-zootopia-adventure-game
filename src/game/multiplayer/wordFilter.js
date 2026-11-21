// A small word filter for nicknames and chat, English and Tagalog. It is a
// demo-level safety net, not a full moderation system: it stops common bad
// words, spaced-out or number-swapped spellings, links and contact details.

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

// Blocked anywhere inside the text, even with spaces between letters. Only
// long, distinctive words go here: the check runs on the text with spaces
// removed, so a short word could match across two innocent words.
const STRONG = [
    // English: swearing and insults
    'fuck', 'shit', 'bitch', 'pussy', 'cunt', 'nigg', 'whore', 'slut', 'bastard', 'asshole', 'dickhead', 'cocksuck',
    'motherfuck', 'bullshit', 'douchebag', 'wanker', 'bollocks', 'faggot', 'retard', 'tranny',
    // English: body parts and sexual words kids should not be saying
    'penis', 'vagina', 'porn', 'blowjob', 'handjob', 'dildo', 'clitoris', 'scrotum', 'testicle', 'genital',
    'orgasm', 'masturbat', 'erotic', 'hentai', 'nipple', 'boobs', 'titties', 'butthole', 'sperm', 'pedophil', 'molest',
    'incest', 'jerkoff', 'fingering',
    // English: hate, violence, drugs
    'nazi', 'hitler', 'cocaine', 'marijuana', 'heroin', 'methamph', 'shabu',
    // Tagalog / Filipino: swearing and insults
    'putang', 'putragis', 'tangina', 'tanginamo', 'potangina', 'pakyu', 'pakshet', 'pakingshet', 'tarantado', 'pokpok',
    'bwisit', 'buwisit', 'kupal', 'siraulo', 'gagu', 'punyeta', 'hinayupak', 'hayopka', 'animalka', 'ulol', 'ungas',
    'walanghiya',
    // Tagalog / Filipino: body parts and sexual words
    'puking', 'pukinang', 'pukeng', 'pekpek', 'betlog', 'pototoy', 'pututoy', 'kargada', 'kantot', 'kantutan', 'iyutan',
    'jakol', 'jabol', 'salsal', 'tsupa', 'chupa', 'malibog', 'torjak', 'tumbong', 'hubadhubo',
    // taking the chat somewhere else
    'facebook', 'messenger', 'tiktok', 'discord', 'instagram', 'whatsapp', 'telegram', 'viber', 'snapchat', 'gmail',
];

// Blocked only as a whole word, so words like "class" or "essex" stay fine.
const WORDS = new Set([
    // English
    'ass', 'dick', 'cock', 'sex', 'sexy', 'fag', 'rape', 'rapist', 'nude', 'nudes', 'naked', 'nsfw', 'kill', 'die', 'dead', 'suicide',
    'murder', 'gun', 'damn', 'crap', 'idiot', 'stupid', 'dumb', 'hell', 'wtf', 'stfu', 'kys', 'moron', 'loser',
    'boob', 'tits', 'titty', 'tit', 'butt', 'anus', 'anal', 'cum', 'balls', 'semen', 'horny', 'twat', 'prick', 'milf',
    'pedo', 'dyke', 'chink', 'spic', 'kike', 'coon', 'bomb', 'terrorist', 'weed', 'vape', 'beer', 'whisky', 'vodka',
    'pee', 'poop', 'fart', 'piss', 'wank', 'jerk', 'dildo', 'thot', 'simp',
    // Tagalog / Filipino ("hayop" means animal in a zoo game, so only "hayop ka" is blocked)
    'gago', 'gaga', 'tanga', 'bobo', 'boba', 'puta', 'tite', 'burat', 'leche', 'demonyo', 'lintik', 'pesteng', 'inutil',
    'engot', 'baliw', 'patay', 'buang', 'tarantado', 'hudas', 'batugan', 'supot',
    'titi', 'etits', 'puki', 'puke', 'kipay', 'kiffy', 'bilat', 'puday', 'suso', 'utong',
    'pwet', 'puwet', 'puwit', 'pigi', 'pwitan', 'libog', 'iyot', 'chupa', 'hubad', 'hubo', 'bayag', 'itlog', 'kulangot',
    'tae', 'ihi', 'dede', 'putik', 'potek', 'pucha', 'syet', 'shet', 'kantot', 'jakol',
].filter((word) => !['omg', 'itlog', 'tae', 'ihi', 'putik', 'dede', 'pee', 'poop', 'fart', 'beer', 'jerk', 'loser', 'pucha', 'syet', 'shet', 'potek'].includes(word)));

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
    // "t i t i": single letters spaced out are joined back into one word.
    const joined = [];
    let run = '';
    words.forEach((word) => {
        if (word.length === 1) {
            run += word;
            return;
        }
        if (run.length >= 3) joined.push(run);
        run = '';
    });
    if (run.length >= 3) joined.push(run);
    return [...words, ...joined].some((word) => WORDS.has(word) || WORDS.has(word.replace(/(.)\1+/g, '$1')));
}

const LINK = /(https?:|www\.|:\/\/|\.com|\.net|\.org|\.ph\b|\.gg\b|\.io\b|\.me\b|dot ?com)/i;

export function looksLikeLinkOrContact(text) {
    return LINK.test(String(text)) || /\d{5,}/.test(String(text).replace(/[\s.-]/g, ''));
}
