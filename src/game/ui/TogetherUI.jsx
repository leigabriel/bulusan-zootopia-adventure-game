import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, ModalShell, cx } from './UIComponents.jsx';
import { t, useLanguage, getLanguage } from '../i18n/index.js';
import {
    EMOTES, MAX_CHAT_LENGTH, NICK_MAX_TYPED, ROOM_CODE_LENGTH, isValidRoomCode, makeNickname,
    nicknameProblem, normalizeNickname, normalizeRoomCode,
} from '../multiplayer/protocol.js';
import { getMultiplayerUrl, getSavedNickname, saveNickname } from '../multiplayer/config.js';
import { reserveRoom } from '../multiplayer/reserve.js';

const NICK_MESSAGES = {
    short: 'Your name needs at least 3 letters.',
    long: 'That name is too long.',
    chars: 'Use letters, numbers and spaces only.',
    contact: 'Please do not use links or phone numbers.',
    blocked: 'Please pick a kind name.',
};

const CHAT_MESSAGES = {
    blocked: 'Please use kind words.',
    contact: 'Do not share links or numbers.',
    chars: 'Use letters and numbers only.',
    long: 'That message is too long.',
    slow: 'Slow down a little!',
};

const EMOTE_ICONS = { wave: '👋', heart: '❤️', hello: '😊', thanks: '🌼', clap: '👏', star: '⭐' };

const FIELD = 'w-full min-w-0 rounded-xl border-2 border-emerald-700/30 bg-white px-3 py-1.5 text-sm font-black text-slate-800 outline-none focus:border-emerald-600';

const MODES = [
    { id: 'public', label: 'Public Zoo' },
    { id: 'create', label: 'Create Room' },
    { id: 'join', label: 'Join Room' },
];

// Pick or type a nickname, then choose the public zoo, a new private room, or
// a friend's room code.
export function TogetherSetupModal({ isOpen, onClose, onStart }) {
    useLanguage();
    const [nick, setNick] = useState(() => getSavedNickname());
    const [typing, setTyping] = useState(false);
    const [typed, setTyped] = useState('');
    const [mode, setMode] = useState('public');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    // Create Room: the room is made first so its code can be read before playing.
    const [creating, setCreating] = useState(false);
    const [room, setRoom] = useState(null); // { code, release, nick }
    const [copied, setCopied] = useState(false);
    const roomRef = useRef(null);
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            roomRef.current?.release();
            roomRef.current = null;
        };
    }, []);

    // Closing the window gives the room back.
    useEffect(() => {
        if (isOpen) return;
        roomRef.current?.release();
        roomRef.current = null;
        setRoom(null);
        setCreating(false);
    }, [isOpen]);

    const shuffle = () => {
        setNick(makeNickname());
        setTyping(false);
        setError('');
    };

    const pickName = () => {
        let finalNick = nick;
        if (typing) {
            finalNick = normalizeNickname(typed);
            const problem = nicknameProblem(finalNick);
            if (problem) {
                setError(NICK_MESSAGES[problem] || NICK_MESSAGES.chars);
                return null;
            }
        }
        return finalNick;
    };

    const start = async () => {
        if (creating) return;
        const finalNick = pickName();
        if (finalNick === null) return;
        if (mode === 'join' && !isValidRoomCode(code)) {
            setError('Type the 4 letters or numbers of your friend\'s room.');
            return;
        }
        saveNickname(finalNick);
        if (mode === 'create') {
            setCreating(true);
            setError('');
            try {
                const reserved = await reserveRoom({ url: getMultiplayerUrl(), nick: finalNick });
                if (!aliveRef.current) { reserved.release(); return; }
                roomRef.current = reserved;
                setRoom({ ...reserved, nick: finalNick });
            } catch {
                if (aliveRef.current) setError('We could not make a room. Check your internet and try again.');
            } finally {
                if (aliveRef.current) setCreating(false);
            }
            return;
        }
        onStart({ nick: finalNick, mode, code: mode === 'join' ? code : '' });
    };

    const enterRoom = () => {
        if (!room) return;
        // The game joins the room by its code; the held connection is let go
        // once the game is inside (see startTogether).
        const release = room.release;
        roomRef.current = null;
        onStart({ nick: room.nick, mode: 'join', code: room.code, release });
    };

    const backFromRoom = () => {
        roomRef.current?.release();
        roomRef.current = null;
        setRoom(null);
        setCopied(false);
    };

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(room.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard is not allowed here: the code is on screen */ }
    };

    const startLabel = mode === 'create' ? 'Create Room' : mode === 'join' ? 'Join Room' : 'Join the Zoo';

    // Step 2 of Create Room: show the code first, then play.
    if (room) {
        return (
            <ModalShell
                isOpen={isOpen}
                onClose={onClose}
                title="Your Room"
                size="sm"
                compact
                footer={(
                    <div className="grid grid-cols-2 gap-2">
                        <ActionButton variant="secondary" size="sm" onClick={backFromRoom}>{t('Back')}</ActionButton>
                        <ActionButton size="sm" onClick={enterRoom}>{t('Start Playing')}</ActionButton>
                    </div>
                )}
            >
                <div className="flex w-full flex-col items-center gap-2 text-center">
                    <p className="text-xs font-bold">{t('Your room is ready! Tell your friends this code.')}</p>
                    <div className="flex gap-1.5" aria-label={room.code} role="img">
                        {room.code.split('').map((char, index) => (
                            <span key={index} className="grid h-12 w-10 place-items-center rounded-xl border-2 border-emerald-700/40 bg-white text-2xl font-black text-emerald-800 shadow-sm">{char}</span>
                        ))}
                    </div>
                    <ActionButton variant="warning" size="sm" onClick={copyCode}>{copied ? t('Copied!') : t('Copy Code')}</ActionButton>
                    <p className="text-[11px] font-semibold opacity-80">{t('Friends tap Join Room and type this code. Keep this window open until they are ready, or just start playing.')}</p>
                </div>
            </ModalShell>
        );
    }

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Play Together"
            size="md"
            compact
            footer={(
                <div className="grid grid-cols-2 gap-2">
                    <ActionButton variant="secondary" size="sm" onClick={onClose}>{t('Back')}</ActionButton>
                    <ActionButton size="sm" onClick={start} disabled={creating}>{creating ? t('Making your room...') : t(startLabel)}</ActionButton>
                </div>
            )}
        >
            <div className="flex w-full flex-col gap-2 text-center">
                <p className="text-xs font-bold">{t('Walk around the zoo with other kids! Everyone sees your zoo name, not your real name.')}</p>

                <div className="rounded-xl border-2 border-emerald-700/30 bg-white/70 px-3 py-1.5 text-base font-black" aria-live="polite">
                    {typing ? (typed || '...') : nick}
                </div>

                {typing ? (
                    <div className="flex flex-col gap-1 text-left">
                        <label className="text-[11px] font-black" htmlFor="together-nick">{t('Type your zoo name')}</label>
                        <input
                            id="together-nick"
                            className={FIELD}
                            value={typed}
                            maxLength={NICK_MAX_TYPED}
                            autoComplete="off"
                            autoCapitalize="words"
                            spellCheck={false}
                            placeholder={t('Your zoo name')}
                            onChange={(event) => { setTyped(event.target.value); setError(''); }}
                        />
                        <p className="text-[11px] font-semibold opacity-80">{t('Do not use your real name.')}</p>
                    </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                    <ActionButton variant="warning" size="sm" onClick={shuffle}>{t('Shuffle Name')}</ActionButton>
                    <ActionButton
                        variant="secondary"
                        size="sm"
                        onClick={() => { setTyping((value) => !value); setError(''); }}
                    >
                        {typing ? t('Use Shuffled Name') : t('Type My Own Name')}
                    </ActionButton>
                </div>

                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('Where to play')}>
                    {MODES.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={mode === item.id}
                            data-ui-button="true"
                            onClick={() => { setMode(item.id); setError(''); }}
                            className={cx(
                                'min-h-10 rounded-xl border-2 px-1 text-xs font-black leading-tight active:scale-95',
                                mode === item.id ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'border-emerald-700/20 bg-white/70 text-slate-700',
                            )}
                        >
                            {t(item.label)}
                        </button>
                    ))}
                </div>

                {mode === 'create' ? <p className="text-[11px] font-semibold opacity-80">{t('You get a room code first. Tell your friends so they can join you.')}</p> : null}
                {mode === 'public' ? <p className="text-[11px] font-semibold opacity-80">{t('Meet kids from all over in the open zoo.')}</p> : null}
                {mode === 'join' ? (
                    <div className="flex flex-col gap-1 text-left">
                        <label className="text-[11px] font-black" htmlFor="together-code">{t('Room code')}</label>
                        <input
                            id="together-code"
                            className={cx(FIELD, 'text-center text-xl tracking-[0.4em] uppercase')}
                            value={code}
                            maxLength={ROOM_CODE_LENGTH}
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            placeholder="----"
                            onChange={(event) => { setCode(normalizeRoomCode(event.target.value)); setError(''); }}
                        />
                    </div>
                ) : null}

                {error ? <p role="alert" className="text-xs font-black text-rose-600">{t(error)}</p> : null}
                <p className="text-[11px] font-semibold opacity-80">{t('Say hi with fun buttons or kind words. Never share personal details.')}</p>
            </div>
        </ModalShell>
    );
}

function statusText(status) {
    switch (status) {
        case 'connecting': return 'Finding friends...';
        case 'full': return 'That room is full right now. You are playing alone.';
        case 'notfound': return 'We could not find that room. Check the code and try again.';
        case 'kicked': return 'You were moved out of the room. You are playing alone.';
        case 'error': return 'Cannot reach other players. You are playing alone.';
        default: return '';
    }
}

// Header button: sits in the top right row, next to the Tasks button.
export function TogetherChip({ info, open, onToggle }) {
    useLanguage();
    if (!info) return null;
    const online = info.status === 'online';
    const count = info.players.length + (online ? 1 : 0);
    return (
        <button
            type="button"
            data-ui-button="true"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={t('Players')}
            className="sz-card pointer-events-auto flex min-h-12 shrink-0 items-center gap-2 rounded-2xl! px-3 shadow-none! active:scale-95"
        >
            <span className={cx('h-3 w-3 shrink-0 rounded-full', online ? 'bg-(--sz-green)' : 'bg-amber-400')} />
            <span className="text-[16px] font-black">{online ? count : '—'}</span>
            <span className="hidden text-sm font-black min-[420px]:inline">{t('Players')}</span>
        </button>
    );
}

// Drops down from the header, under the right-hand buttons, so it never sits on them.
export function TogetherPanel({ info, open, onClose, onEmote, onMute, onReport, onLeave }) {
    useLanguage();
    const [reporting, setReporting] = useState(null);
    const [copied, setCopied] = useState(false);
    if (!info) return null;
    const language = getLanguage();
    const online = info.status === 'online';
    const message = statusText(info.status);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(info.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* the code is on screen to read out */ }
    };

    return (
        <>
            {message ? (
                <p role="status" className="sz-card pointer-events-none absolute right-2 top-[calc(env(safe-area-inset-top)+8.75rem)] z-66 max-w-56 rounded-xl! px-3 py-2 text-xs font-black">
                    {t(message)}
                </p>
            ) : null}

            {open ? (
                <div
                    className="sz-card pointer-events-auto absolute right-2 top-[calc(env(safe-area-inset-top)+8.75rem)] z-66 flex max-h-[min(24rem,calc(100dvh-10rem))] w-64 max-w-[78vw] flex-col gap-2 overflow-y-auto rounded-2xl! p-3"
                    data-ui-hud="true"
                    data-ui-touch-pass="true"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black">{t('Players')}</span>
                        <button type="button" data-ui-button="true" onClick={onClose} className="rounded-lg bg-white/80 px-2 py-1 text-xs font-black">{t('Close')}</button>
                    </div>

                    {online && info.code ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-100 px-3 py-2">
                            <div className="min-w-0">
                                <div className="text-[11px] font-black uppercase opacity-70">{t('Room code')}</div>
                                <div className="text-2xl font-black tracking-[0.3em]">{info.code}</div>
                            </div>
                            <button type="button" data-ui-button="true" onClick={copyCode} className="rounded-lg bg-white/90 px-2 py-1 text-xs font-black">{copied ? t('Copied!') : t('Copy')}</button>
                        </div>
                    ) : null}

                    {online ? (
                        <div className="grid grid-cols-3 gap-2">
                            {EMOTES.map((emote) => (
                                <button
                                    key={emote.id}
                                    type="button"
                                    data-ui-button="true"
                                    onClick={() => onEmote(emote.id)}
                                    className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-white/80 px-1 py-1 text-xs font-black active:scale-95"
                                >
                                    <span className="text-xl leading-none" aria-hidden="true">{EMOTE_ICONS[emote.id]}</span>
                                    <span>{language === 'tl' ? emote.tl : emote.en}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    <ul className="flex flex-col gap-1">
                        {info.players.length === 0 && online ? <li className="text-xs font-bold opacity-80">{t('No one else is here yet.')}</li> : null}
                        {info.players.map((player) => (
                            <li key={player.id} className="flex items-center justify-between gap-2 text-sm font-black">
                                <span className={cx('min-w-0 truncate', player.muted && 'line-through opacity-60')}>{player.nick}</span>
                                <span className="flex shrink-0 gap-1">
                                    <button type="button" data-ui-button="true" onClick={() => onMute(player.id)} className="rounded-lg bg-white/80 px-2 py-1 text-xs font-black">{player.muted ? t('Show') : t('Hide')}</button>
                                    {player.reported ? null : (
                                        <button type="button" data-ui-button="true" onClick={() => setReporting(player)} className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">{t('Report')}</button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <ActionButton variant="secondary" size="sm" onClick={() => { onClose(); onLeave(); }}>{t('Play Alone')}</ActionButton>
                </div>
            ) : null}

            <ModalShell
                isOpen={Boolean(reporting)}
                onClose={() => setReporting(null)}
                title="Tell the Zoo Helpers?"
                size="sm"
                footer={(
                    <div className="grid grid-cols-2 gap-2">
                        <ActionButton variant="secondary" size="sm" onClick={() => setReporting(null)}>{t('Cancel')}</ActionButton>
                        <ActionButton variant="danger" size="sm" onClick={() => { onReport(reporting.id); setReporting(null); }}>{t('Report')}</ActionButton>
                    </div>
                )}
            >
                <p className="text-center text-sm font-bold">
                    {t('Hide {name} and tell the zoo helpers?', { name: reporting?.nick || '' })}
                </p>
            </ModalShell>
        </>
    );
}

// Chat in the top left, under the task card. Closed it is one small button.
export function TogetherChat({ info, open, onOpenChange, onSend }) {
    useLanguage();
    const setOpen = onOpenChange;
    const [text, setText] = useState('');
    const [seen, setSeen] = useState(0);
    const logRef = useRef(null);
    const messages = info?.messages;
    const latest = messages?.length ? messages[messages.length - 1].key : 0;

    useEffect(() => {
        if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [open, latest]);

    if (!info || info.status !== 'online') return null;
    const unread = !open && latest > seen;

    const submit = (event) => {
        event.preventDefault();
        if (onSend(text)) setText('');
    };

    if (!open) {
        return (
            <button
                type="button"
                data-ui-button="true"
                data-ui-hud="true"
                onClick={() => { setSeen(latest); setOpen(true); }}
                aria-label={t('Open chat')}
                className="sz-card pointer-events-auto relative flex min-h-12 items-center gap-2 rounded-2xl! px-3 shadow-none! active:scale-95"
            >
                <span aria-hidden="true" className="text-lg leading-none">{'💬'}</span>
                <span className="text-sm font-black">{t('Chat')}</span>
                {unread ? <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-500" /> : null}
            </button>
        );
    }

    return (
        <div className="sz-card pointer-events-auto flex w-60 max-w-[58vw] flex-col gap-1.5 rounded-2xl! p-2" data-ui-hud="true" data-ui-touch-pass="true">
            <div className="flex items-center justify-between">
                <span className="text-sm font-black">{t('Chat')}</span>
                <button type="button" data-ui-button="true" onClick={() => { setSeen(latest); setOpen(false); }} aria-label={t('Close chat')} className="rounded-lg bg-white/80 px-2 py-0.5 text-xs font-black">{t('Close')}</button>
            </div>
            <div ref={logRef} className="max-h-[min(6.5rem,20dvh)] min-h-10 overflow-y-auto rounded-xl bg-white/70 px-2 py-1" aria-live="polite">
                {info.messages.length === 0 ? <p className="text-xs font-bold opacity-70">{t('Say hi to your friends!')}</p> : null}
                {info.messages.map((message) => (
                    <p key={message.key} className="break-words text-xs font-bold leading-snug">
                        <span className={cx('font-black', message.mine ? 'text-emerald-700' : 'text-sky-700')}>{message.nick}: </span>
                        {message.text}
                    </p>
                ))}
            </div>
            {info.notice ? <p role="alert" className="text-xs font-black text-rose-600">{t(CHAT_MESSAGES[info.notice] || CHAT_MESSAGES.chars)}</p> : null}
            <form onSubmit={submit} className="flex gap-1.5">
                <input
                    className={cx(FIELD, 'py-1.5! text-sm!')}
                    value={text}
                    maxLength={MAX_CHAT_LENGTH}
                    autoComplete="off"
                    enterKeyHint="send"
                    placeholder={t('Type a kind message')}
                    aria-label={t('Type a kind message')}
                    onChange={(event) => setText(event.target.value)}
                />
                <button type="submit" data-ui-button="true" className="shrink-0 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white active:scale-95">{t('Send')}</button>
            </form>
        </div>
    );
}
