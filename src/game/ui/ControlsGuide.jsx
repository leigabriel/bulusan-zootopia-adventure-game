/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { cx } from './UIComponents.jsx';

// Kid-friendly "how do I play" guide with separate pages for a computer
// (keyboard and mouse) and for a phone or tablet (touch). Short words, one
// idea per card, and a picture or keycap for every action.

export function usesTouchControls() {
    if (typeof navigator === 'undefined') return false;
    return Capacitor.isNativePlatform() || /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function Key({ children, wide = false }) {
    return (
        <kbd className={cx(
            'inline-flex h-9 items-center justify-center rounded-lg border-2 border-slate-300 bg-white px-2 font-sans text-sm font-black text-slate-800 shadow-[0_3px_0_0_#cbd5e1]',
            wide ? 'min-w-16' : 'min-w-9',
        )}>
            {children}
        </kbd>
    );
}

function Emoji({ children }) {
    return <span className="text-3xl leading-none" aria-hidden="true">{children}</span>;
}

// `visual` is what the child sees (keys, a picture); `title` and `text` say it
// in a few plain words.
export const COMPUTER_CONTROLS = [
    {
        id: 'walk',
        tone: 'bg-emerald-50 border-emerald-200',
        title: 'Walk around',
        text: 'W goes forward, S goes back, A goes left, D goes right.',
        visual: (
            <div className="grid grid-cols-3 gap-1 place-items-center" aria-hidden="true">
                <span />
                <Key>W</Key>
                <span />
                <Key>A</Key>
                <Key>S</Key>
                <Key>D</Key>
            </div>
        ),
    },
    {
        id: 'look',
        tone: 'bg-amber-50 border-amber-200',
        title: 'Look around',
        text: 'Hold the left mouse button and move the mouse.',
        visual: <Emoji>🖱️</Emoji>,
    },
    {
        id: 'zoom',
        tone: 'bg-sky-50 border-sky-200',
        title: 'Come closer or go back',
        text: 'Roll the mouse wheel. Up is closer. Down is farther.',
        visual: <Emoji>🔍</Emoji>,
    },
    {
        id: 'jump',
        tone: 'bg-lime-50 border-lime-200',
        title: 'Jump',
        text: 'Press the big Space bar to hop up.',
        visual: <Key wide>SPACE</Key>,
    },
    {
        id: 'feed',
        tone: 'bg-rose-50 border-rose-200',
        title: 'Feed an animal',
        text: 'Stand near a friendly animal. Hold F until the food is given.',
        visual: <Key>F</Key>,
    },
    {
        id: 'talk',
        tone: 'bg-violet-50 border-violet-200',
        title: 'Talk or pick up',
        text: 'Stand near a ranger and press T or E. Press E to pick up hay and carrots.',
        visual: (
            <div className="flex gap-1.5" aria-hidden="true">
                <Key>T</Key>
                <Key>E</Key>
            </div>
        ),
    },
    {
        id: 'view',
        tone: 'bg-teal-50 border-teal-200',
        title: 'Change the view',
        text: 'Press V to see through your own eyes or from behind.',
        visual: <Key>V</Key>,
    },
    {
        id: 'menu',
        tone: 'bg-slate-50 border-slate-200',
        title: 'Close a window',
        text: 'Press Esc to close a window or to open the menu.',
        visual: <Key wide>ESC</Key>,
    },
];

export const MOBILE_CONTROLS = [
    {
        id: 'walk',
        tone: 'bg-emerald-50 border-emerald-200',
        title: 'Walk around',
        text: 'Put your left thumb on the round stick. Slide it where you want to go.',
        visual: <Emoji>🕹️</Emoji>,
    },
    {
        id: 'look',
        tone: 'bg-amber-50 border-amber-200',
        title: 'Look around',
        text: 'Slide your finger on the empty part of the screen.',
        visual: <Emoji>👆</Emoji>,
    },
    {
        id: 'zoom',
        tone: 'bg-sky-50 border-sky-200',
        title: 'Come closer or go back',
        text: 'Pinch with two fingers. Spread them apart to come closer. Squeeze them together to go back.',
        visual: <Emoji>🤏</Emoji>,
    },
    {
        id: 'jump',
        tone: 'bg-lime-50 border-lime-200',
        title: 'Jump',
        text: 'Tap the Jump button to hop up.',
        visual: <span className="rounded-full border-2 border-lime-400 bg-lime-100 px-3 py-1.5 text-sm font-black text-lime-800">JUMP</span>,
    },
    {
        id: 'feed',
        tone: 'bg-rose-50 border-rose-200',
        title: 'Feed an animal',
        text: 'Stand near a friendly animal. Press and hold the Feed button until the food is given.',
        visual: <span className="rounded-full border-2 border-rose-300 bg-rose-100 px-3 py-1.5 text-sm font-black text-rose-800">FEED</span>,
    },
    {
        id: 'talk',
        tone: 'bg-violet-50 border-violet-200',
        title: 'Talk to a ranger',
        text: 'Walk near a ranger and tap the Talk button.',
        visual: <span className="rounded-full border-2 border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-800">TALK</span>,
    },
    {
        id: 'tools',
        tone: 'bg-teal-50 border-teal-200',
        title: 'Book and camera',
        text: 'Tap the Book button to read about animals. Tap the Camera button to take a photo.',
        visual: (
            <div className="flex gap-2" aria-hidden="true">
                <Emoji>📖</Emoji>
                <Emoji>📷</Emoji>
            </div>
        ),
    },
    {
        id: 'tasks',
        tone: 'bg-slate-50 border-slate-200',
        title: 'Tasks and menu',
        text: 'Tap the Tasks button to see what to do next. Tap the Menu button to rest or change settings.',
        visual: <Emoji>📋</Emoji>,
    },
];

function ControlCard({ item }) {
    return (
        <li className={cx('flex items-center gap-3 rounded-2xl border-2 p-2.5', item.tone)}>
            <div className="flex min-h-14 w-24 shrink-0 items-center justify-center">{item.visual}</div>
            <div className="min-w-0">
                <p className="text-sm font-black leading-tight text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-[13px] font-bold leading-snug text-slate-600">{item.text}</p>
            </div>
        </li>
    );
}

export function ControlsContent({ initialMode }) {
    const [mode, setMode] = useState(() => initialMode ?? (usesTouchControls() ? 'mobile' : 'computer'));
    const items = mode === 'mobile' ? MOBILE_CONTROLS : COMPUTER_CONTROLS;

    return (
        <div className="flex min-h-0 flex-col gap-3">
            <div className="sz-tabs shrink-0" role="tablist" aria-label="Choose your device">
                <button type="button" role="tab" aria-selected={mode === 'computer'} onClick={() => setMode('computer')} className="sz-tab" data-ui-button="true">
                    <span aria-hidden="true">💻</span> Computer
                </button>
                <button type="button" role="tab" aria-selected={mode === 'mobile'} onClick={() => setMode('mobile')} className="sz-tab" data-ui-button="true">
                    <span aria-hidden="true">📱</span> Phone / Tablet
                </button>
            </div>
            <p className="text-center text-[13px] font-black text-emerald-800">
                {mode === 'mobile' ? 'Use your fingers to play!' : 'Use the keyboard and mouse to play!'}
            </p>
            <ul className="grid gap-2 min-[700px]:grid-cols-2" role="tabpanel">
                {items.map((item) => <ControlCard key={item.id} item={item} />)}
            </ul>
        </div>
    );
}
