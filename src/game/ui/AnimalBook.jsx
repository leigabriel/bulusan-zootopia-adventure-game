import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANIMAL_METADATA, BOOK_CATEGORIES, getAnimalPicture } from '../data/animalMetadata.js';
import { t, useLanguage } from '../i18n/index.js';
import { resolveAssetUrl } from '../utils/localAssets.js';
import {
    BOOK,
    clamp,
    curlStep,
    easeInOutCubic,
    easeOutCubic,
    leafShade,
    stackThickness,
    turnProgressFromDrag,
    shouldCompleteTurn,
} from './bookMath.js';

// A field journal shaped like a real ring-bound book. Two covers lie under a
// two-page spread, the pages have a visible stack of paper at their outer
// edges, and the rings pass through punched holes at the spine. Turning a page
// swings one leaf around the spine. The leaf is cut into thin strips that
// bend a little while it moves, so it curls instead of staying flat.
//
// Spread i holds animal i: its picture and facts on the left page, its fun fact
// and the animal picker on the right page. Leaf i has the right page of spread
// i on its front and the left page of spread i + 1 on its back.

const { STAGE_W, STAGE_H, SPINE_X, PAGE_W, PAGE_H, PAGE_TOP, STRIPS, RING_YS } = BOOK;

function useStageScale() {
    const read = () => {
        if (typeof window === 'undefined') return 1;
        const width = window.innerWidth - 16;
        const height = window.innerHeight - 16;
        return Math.max(0.35, Math.min(width / STAGE_W, height / STAGE_H, 1.35));
    };
    const [scale, setScale] = useState(read);
    useEffect(() => {
        const onResize = () => setScale(read());
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
        };
    }, []);
    return scale;
}

function useAnimalPicture(entry) {
    const path = getAnimalPicture(entry);
    const [resolved, setResolved] = useState({ path: '', url: '' });
    useEffect(() => {
        let alive = true;
        if (path) {
            resolveAssetUrl(path).then((url) => { if (alive && url) setResolved({ path, url }); }).catch(() => {});
        }
        return () => { alive = false; };
    }, [path]);
    return resolved.path === path && resolved.url ? resolved.url : path;
}

function Picture({ entry, className = '' }) {
    const url = useAnimalPicture(entry);
    if (!url) return <span className={className} aria-hidden="true">{entry?.emoji || '🐾'}</span>;
    return <img className={className} src={url} alt={t(entry.name)} draggable="false" />;
}

const Thumb = memo(function Thumb({ entry, selected, found, fed, onPick }) {
    return (
        <button
            type="button"
            className={`zb-thumb${selected ? ' is-selected' : ''}${found ? '' : ' is-unfound'}`}
            onClick={onPick ? () => onPick(entry.name) : undefined}
            aria-label={t(entry.name)}
            aria-pressed={selected}
            tabIndex={onPick ? 0 : -1}
            data-ui-button="true"
        >
            <Picture entry={entry} className="zb-thumb-img" />
            {fed ? <span className="zb-thumb-badge" aria-hidden="true">✓</span> : null}
            {!found ? <span className="zb-thumb-badge zb-thumb-badge--lock" aria-hidden="true">?</span> : null}
        </button>
    );
});

// One printed page. `side` decides which half of the spread it is. The punched
// holes sit where the rings go through.
const Sheet = memo(function Sheet({ side, entryName, foundSet, fedSet, interactive, onPick, language }) {
    const entry = ANIMAL_METADATA.find((item) => item.name === entryName) || ANIMAL_METADATA[0];
    const found = foundSet.has(entry.name);
    const fed = fedSet.has(entry.name);
    const category = BOOK_CATEGORIES.find((item) => item.id === entry.category) || BOOK_CATEGORIES[0];
    const sameKind = ANIMAL_METADATA.filter((item) => item.category === entry.category);
    const foundCount = ANIMAL_METADATA.filter((item) => foundSet.has(item.name)).length;
    const facts = [
        ['Home', entry.habitat],
        ['Food', entry.diet],
        ['Is', entry.behavior],
        ['Safety', entry.status],
    ];

    return (
        <div className={`zb-sheet zb-sheet--${side}`} data-language={language} aria-hidden={interactive ? undefined : 'true'}>
            {RING_YS.map((y) => <span key={y} className="zb-hole" style={{ top: y }} />)}
            {side === 'left' ? (
                <div className="zb-content">
                    <h2 className="zb-title">{t(entry.name)}</h2>
                    <p className="zb-latin">{entry.scientific}</p>
                    <div className="zb-spread">
                        <figure className="zb-photo">
                            <span className="zb-tape" aria-hidden="true" />
                            <Picture entry={entry} className="zb-photo-img" />
                            {fed ? <span className="zb-stamp">{t('Fed!')}</span> : null}
                        </figure>
                        <ul className="zb-facts">
                            {facts.map(([label, value]) => (
                                <li key={label}><b>{t(label)}:</b> {t(value)}</li>
                            ))}
                        </ul>
                    </div>
                    <p className="zb-note zb-note--found">{found ? t('You met me!') : t('Find me in the zoo!')}</p>
                    <p className="zb-note zb-note--count">{t('You found {found} of {total} animals!', { found: foundCount, total: ANIMAL_METADATA.length })}</p>
                </div>
            ) : (
                <div className="zb-content">
                    <h3 className="zb-heading">{t('Fun Fact')}</h3>
                    <p className="zb-fact">{t(entry.fact)}</p>
                    <h3 className="zb-heading zb-heading--small">{t('About me')}</h3>
                    <p className="zb-about">{t(entry.description)}</p>
                    <aside className="zb-card" aria-label={t('Pick an animal')}>
                        <p className="zb-card-title">{t(category.label)}</p>
                        <div className="zb-grid">
                            {sameKind.map((item) => (
                                <Thumb
                                    key={item.name}
                                    entry={item}
                                    selected={item.name === entry.name}
                                    found={foundSet.has(item.name)}
                                    fed={fedSet.has(item.name)}
                                    onPick={interactive ? onPick : undefined}
                                />
                            ))}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
});

// The turning leaf: strips nested from the spine outwards. Each strip is a
// little rotated against the one before it, which bends the paper. Both faces
// of every strip hold a slice of a page, so no content is clipped or doubled.
function Strip({ k, theta, curl, front, back }) {
    const width = PAGE_W / STRIPS;
    const own = k === 0 ? theta : curl;
    const absolute = k === 0 ? theta : theta + curl * k;
    const shade = leafShade(absolute);
    return (
        <div
            className="zb-strip"
            style={{
                width: width + 0.8,
                left: k === 0 ? 0 : width,
                transform: `rotateY(${-own}deg)`,
            }}
        >
            <div className="zb-face zb-face--front">
                <div className="zb-slice" style={{ left: -k * width, width: PAGE_W }}>{front}</div>
                <div className="zb-shade" style={{ opacity: shade }} />
            </div>
            <div className="zb-face zb-face--back">
                <div className="zb-slice" style={{ left: -(PAGE_W - (k + 1) * width), width: PAGE_W }}>{back}</div>
                <div className="zb-shade" style={{ opacity: shade }} />
            </div>
            {k < STRIPS - 1 ? <Strip k={k + 1} theta={theta} curl={curl} front={front} back={back} /> : null}
        </div>
    );
}

export function AnimalBookModal({ isOpen, ...props }) {
    // Mounted only while open, so every opening starts on the right page.
    return isOpen ? <AnimalBookPages {...props} /> : null;
}

function AnimalBookPages({ onClose, discoveredAnimals = [], fedAnimals = {}, onPageTurn, focusEntry, onEntryViewed }) {
    const language = useLanguage();
    const scale = useStageScale();
    const entries = ANIMAL_METADATA;
    const total = entries.length;

    const foundKey = discoveredAnimals.join('|');
    const fedKey = Object.keys(fedAnimals).filter((name) => fedAnimals[name]).join('|');
    const foundSet = useMemo(() => new Set(foundKey ? foundKey.split('|') : []), [foundKey]);
    const fedSet = useMemo(() => new Set(fedKey ? fedKey.split('|') : []), [fedKey]);

    const [spread, setSpread] = useState(() => Math.max(0, entries.findIndex((entry) => entry.name === focusEntry)));
    // While a leaf is moving: which two spreads it joins and its angle (0 = flat on the right).
    const [turn, setTurn] = useState(null);

    const spreadRef = useRef(spread);
    const turnRef = useRef(null);
    const thetaRef = useRef(0);
    const busyRef = useRef(false);
    const rafRef = useRef(0);
    const dragRef = useRef(null);
    const suppressClickRef = useRef(false);
    const scaleRef = useRef(scale);
    const pageTurnRef = useRef(onPageTurn);

    useEffect(() => { scaleRef.current = scale; }, [scale]);
    useEffect(() => { pageTurnRef.current = onPageTurn; }, [onPageTurn]);
    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    const setTheta = useCallback((theta, dir) => {
        thetaRef.current = theta;
        setTurn((current) => (current ? { ...current, theta, dir: dir ?? current.dir } : current));
    }, []);

    const beginTurn = useCallback((from, to) => {
        if (busyRef.current || from === to || to < 0 || to >= total) return false;
        const forward = to > from;
        const next = { lo: Math.min(from, to), hi: Math.max(from, to), theta: forward ? 0 : 180, dir: forward ? 1 : -1 };
        busyRef.current = true;
        turnRef.current = next;
        thetaRef.current = next.theta;
        setTurn(next);
        pageTurnRef.current?.();
        return true;
    }, [total]);

    const settle = useCallback((target, easing, fast) => {
        const startTheta = thetaRef.current;
        const distance = Math.abs(target - startTheta);
        const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const duration = reduced ? 1 : Math.max(160, (fast ? 380 : 720) * (distance / 180));
        const began = performance.now();
        cancelAnimationFrame(rafRef.current);
        const frame = (now) => {
            const progress = clamp((now - began) / duration, 0, 1);
            setTheta(startTheta + (target - startTheta) * easing(progress));
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(frame);
                return;
            }
            const finished = turnRef.current;
            const landed = target >= 180 ? finished.hi : finished.lo;
            spreadRef.current = landed;
            turnRef.current = null;
            busyRef.current = false;
            setSpread(landed);
            setTurn(null);
        };
        rafRef.current = requestAnimationFrame(frame);
    }, [setTheta]);

    const go = useCallback((to) => {
        const from = spreadRef.current;
        if (!beginTurn(from, to)) return;
        settle(to > from ? 180 : 0, easeInOutCubic, false);
    }, [beginTurn, settle]);

    const step = useCallback((direction) => go(spreadRef.current + direction), [go]);

    const pick = useCallback((name) => {
        const target = entries.findIndex((entry) => entry.name === name);
        if (target >= 0) go(target);
    }, [entries, go]);

    // Reading a page that the player has discovered counts as viewing it.
    const entry = entries[spread];
    const found = foundSet.has(entry.name);
    useEffect(() => {
        if (found && !turn) onEntryViewed?.(entry.name);
    }, [found, entry.name, turn, onEntryViewed]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'ArrowLeft') step(-1);
            else if (event.key === 'ArrowRight') step(1);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [step]);

    // Mouse drag and touch swipe share the pointer events. A short press is
    // still a click, so the picker thumbnails keep working.
    const onPointerDown = (event) => {
        if (busyRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false, dir: 0, progress: 0, lastX: event.clientX, lastT: event.timeStamp, velocity: 0 };
    };

    const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.active) {
            if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
            const dir = dx < 0 ? 1 : -1;
            if (!beginTurn(spreadRef.current, spreadRef.current + dir)) {
                dragRef.current = null;
                return;
            }
            drag.active = true;
            drag.dir = dir;
            drag.x = event.clientX;
            event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        const travelled = (event.clientX - drag.x) / scaleRef.current;
        const progress = turnProgressFromDrag(travelled, drag.dir);
        drag.progress = progress;
        const elapsed = Math.max(1, event.timeStamp - drag.lastT);
        drag.velocity = ((event.clientX - drag.lastX) / scaleRef.current) / elapsed;
        drag.lastX = event.clientX;
        drag.lastT = event.timeStamp;
        setTheta(drag.dir > 0 ? progress * 180 : 180 - progress * 180);
    };

    const endDrag = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        dragRef.current = null;
        if (!drag.active) return;
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const complete = event.type !== 'pointercancel' && shouldCompleteTurn(drag.progress, drag.velocity * drag.dir * -1);
        settle(complete ? (drag.dir > 0 ? 180 : 0) : (drag.dir > 0 ? 0 : 180), easeOutCubic, true);
    };

    const onClickCapture = (event) => {
        if (suppressClickRef.current) {
            event.stopPropagation();
            event.preventDefault();
        }
    };

    const category = BOOK_CATEGORIES.find((item) => item.id === entry.category) || BOOK_CATEGORIES[0];
    const lo = turn ? turn.lo : spread;
    const hi = turn ? turn.hi : spread;
    const theta = turn ? turn.theta : 0;
    const position = turn ? lo + theta / 180 : spread;
    const leftStack = stackThickness(position, total, 'left');
    const rightStack = stackThickness(position, total, 'right');
    const interactive = !turn;
    const curl = turn ? curlStep(theta, turn.dir) : 0;
    const radians = (theta * Math.PI) / 180;
    // Shadow the moving leaf throws on the page under it.
    const castRight = theta < 90 ? Math.sin(radians) * 0.5 : 0;
    const castLeft = theta > 90 ? Math.sin(radians) * 0.5 : 0;
    const castRightWidth = PAGE_W * (0.35 + 0.65 * Math.abs(Math.cos(radians)));
    const castLeftWidth = PAGE_W * (0.35 + 0.65 * Math.abs(Math.cos(radians)));

    const sheetProps = { foundSet, fedSet, language };
    const leftPageEntry = entries[lo].name;
    const rightPageEntry = entries[hi].name;

    return (
        <div className="zb-backdrop fixed inset-0 z-120 flex items-center justify-center touch-none" data-ui-modal="true" role="dialog" aria-modal="true" aria-label={t('Animal Book')}>
            <div className="zb-stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
                {/* Ribbon tabs poking out of the top of the book */}
                <div className="zb-tabs" role="tablist" aria-label={t('Kinds of animals')}>
                    {BOOK_CATEGORIES.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={item.id === category.id}
                            className={`zb-tab${item.id === category.id ? ' is-active' : ''}`}
                            style={{ '--tab': item.color }}
                            onClick={() => pick(entries.find((animal) => animal.category === item.id).name)}
                            title={t(item.label)}
                            data-ui-button="true"
                        >
                            <span aria-hidden="true">{item.icon}</span>
                        </button>
                    ))}
                </div>

                <div
                    className="zb-book"
                    style={{ '--spine': `${SPINE_X}px`, '--page-w': `${PAGE_W}px`, '--page-h': `${PAGE_H}px`, '--page-top': `${PAGE_TOP}px` }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClickCapture={onClickCapture}
                >
                    {/* Front and back covers with the hinge between them */}
                    <div className="zb-board zb-board--left" />
                    <div className="zb-board zb-board--right" />
                    <div className="zb-hinge" />

                    {/* Stacks of paper show how many pages are on each side */}
                    <div className="zb-edge zb-edge--left-side" style={{ width: leftStack, height: PAGE_H + leftStack * 0.6 }} />
                    <div className="zb-edge zb-edge--left-bottom" style={{ height: leftStack * 0.6, width: PAGE_W + leftStack }} />
                    <div className="zb-edge zb-edge--right-side" style={{ width: rightStack, height: PAGE_H + rightStack * 0.6 }} />
                    <div className="zb-edge zb-edge--right-bottom" style={{ height: rightStack * 0.6, width: PAGE_W + rightStack }} />

                    {/* The two pages lying flat */}
                    <section className="zb-slot zb-slot--left" aria-live="polite">
                        <Sheet side="left" entryName={leftPageEntry} interactive={interactive} onPick={pick} {...sheetProps} />
                        {castLeft > 0 ? <div className="zb-cast zb-cast--left" style={{ opacity: castLeft, width: castLeftWidth }} /> : null}
                    </section>
                    <section className="zb-slot zb-slot--right">
                        <Sheet side="right" entryName={rightPageEntry} interactive={interactive} onPick={pick} {...sheetProps} />
                        {castRight > 0 ? <div className="zb-cast zb-cast--right" style={{ opacity: castRight, width: castRightWidth }} /> : null}
                    </section>
                    <div className="zb-gutter" />

                    {/* The leaf in motion */}
                    {turn ? (
                        <div className="zb-leaf" aria-hidden="true">
                            <Strip
                                k={0}
                                theta={theta}
                                curl={curl}
                                front={<Sheet side="right" entryName={entries[turn.lo].name} interactive={false} {...sheetProps} />}
                                back={<Sheet side="left" entryName={entries[turn.hi].name} interactive={false} {...sheetProps} />}
                            />
                        </div>
                    ) : null}

                    {/* Rings: they pass through the holes on both pages */}
                    <div className="zb-rings" aria-hidden="true">
                        {RING_YS.map((y) => <span key={y} className="zb-ring" style={{ top: y }} />)}
                    </div>
                </div>

                <button type="button" className="zb-arrow zb-arrow--prev" onClick={() => step(-1)} disabled={spread === 0 || Boolean(turn)} aria-label={t('Previous page')} data-ui-button="true">&#10094;</button>
                <button type="button" className="zb-arrow zb-arrow--next" onClick={() => step(1)} disabled={spread === total - 1 || Boolean(turn)} aria-label={t('Next page')} data-ui-button="true">&#10095;</button>
                <p className="zb-counter" aria-live="polite">{t('{page} of {total}', { page: Math.round(position) + 1, total })}</p>

                <button type="button" className="zb-close" onClick={onClose} aria-label={t('Close')} data-ui-button="true">&times;</button>
            </div>
        </div>
    );
}
