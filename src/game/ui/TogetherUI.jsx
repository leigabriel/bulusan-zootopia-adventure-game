import React, { useState } from 'react';
import { ActionButton, ModalShell, cx } from './UIComponents.jsx';
import { t, useLanguage, getLanguage } from '../i18n/index.js';
import { EMOTES, makeNickname } from '../multiplayer/protocol.js';
import { getSavedNickname, saveNickname } from '../multiplayer/config.js';

// Pick a nickname from the list (no typing) and join the shared zoo.
export function TogetherSetupModal({ isOpen, onClose, onStart }) {
    useLanguage();
    const [nick, setNick] = useState(() => getSavedNickname());

    const shuffle = () => setNick(makeNickname());
    const start = () => {
        saveNickname(nick);
        onStart(nick);
    };

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Play Together"
            size="md"
            footer={(
                <div className="grid grid-cols-2 gap-2">
                    <ActionButton variant="secondary" size="sm" onClick={onClose}>{t('Back')}</ActionButton>
                    <ActionButton size="sm" onClick={start}>{t('Join the Zoo')}</ActionButton>
                </div>
            )}
        >
            <div className="flex w-full flex-col items-center gap-3 text-center">
                <p className="text-sm font-bold">{t('Walk around the zoo with other kids! Everyone sees your zoo name, not your real name.')}</p>
                <div className="rounded-2xl border-2 border-emerald-700/30 bg-white/70 px-4 py-3 text-xl font-black" aria-live="polite">{nick}</div>
                <ActionButton variant="warning" size="sm" onClick={shuffle}>{t('Shuffle Name')}</ActionButton>
                <p className="text-xs font-semibold opacity-80">{t('You can say hi with fun buttons. There is no chat.')}</p>
            </div>
        </ModalShell>
    );
}

const EMOTE_ICONS = { wave: '👋', heart: '❤️', hello: '😊', thanks: '🌼', clap: '👏', star: '⭐' };

function statusText(status) {
    switch (status) {
        case 'connecting': return t('Finding friends...');
        case 'full': return t('The zoo is full right now. You are playing alone.');
        case 'kicked': return t('You were moved out of the room. You are playing alone.');
        case 'error': return t('Cannot reach other players. You are playing alone.');
        default: return '';
    }
}

// Small button at the side of the screen: opens emotes and the people list.
export function TogetherHUD({ info, onEmote, onMute, onReport, onLeave }) {
    useLanguage();
    const [open, setOpen] = useState(false);
    const [reporting, setReporting] = useState(null);
    if (!info) return null;
    const language = getLanguage();
    const online = info.status === 'online';
    const message = statusText(info.status);
    const count = info.players.length + (online ? 1 : 0);

    return (
        <div className="pointer-events-none absolute right-2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-66 flex flex-col items-end gap-2 select-none" data-ui-hud="true">
            <button
                type="button"
                data-ui-button="true"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={t('Players')}
                className="sz-card pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl! px-3 active:scale-95"
            >
                <span className={cx('h-3 w-3 rounded-full', online ? 'bg-(--sz-green)' : 'bg-amber-400')} />
                <span className="text-[16px] font-black">{online ? count : '—'}</span>
                <span className="text-sm font-black">{t('Players')}</span>
            </button>

            {message ? <p role="status" className="sz-card pointer-events-none max-w-56 rounded-xl! px-3 py-2 text-xs font-black">{message}</p> : null}

            {open ? (
                <div className="sz-card pointer-events-auto flex max-h-[60dvh] w-64 max-w-[80vw] flex-col gap-2 overflow-y-auto rounded-2xl! p-3" data-ui-touch-pass="true">
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
                    <ActionButton variant="secondary" size="sm" onClick={() => { setOpen(false); onLeave(); }}>{t('Play Alone')}</ActionButton>
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
        </div>
    );
}
