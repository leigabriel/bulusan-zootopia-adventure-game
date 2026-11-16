import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ANIMAL_METADATA, BOOK_CATEGORIES, getAnimalPicture } from '../data/animalMetadata.js';
import { t, useLanguage } from '../i18n/index.js';
import { resolveAssetUrl } from '../utils/localAssets.js';

// A field journal in the style of a ring-bound nature notebook: the left page
// shows the chosen animal with its picture and short facts, the right page holds
// a fun fact and a loose card with every animal of the same kind to pick from.

// The book is drawn at a fixed size and scaled to fit the window, so the layout
// stays the same on a phone, a tablet and a desktop.
const STAGE_W = 960;
const STAGE_H = 540;

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

function Thumb({ entry, selected, found, fed, onPick }) {
    return (
        <button
            type="button"
            className={`zb-thumb${selected ? ' is-selected' : ''}${found ? '' : ' is-unfound'}`}
            onClick={() => onPick(entry.name)}
            aria-label={t(entry.name)}
            aria-pressed={selected}
            data-ui-button="true"
        >
            <Picture entry={entry} className="zb-thumb-img" />
            {fed ? <span className="zb-thumb-badge" aria-hidden="true">✓</span> : null}
            {!found ? <span className="zb-thumb-badge zb-thumb-badge--lock" aria-hidden="true">?</span> : null}
        </button>
    );
}

export function AnimalBookModal({ isOpen, ...props }) {
    // Mounted only while open, so every opening starts on the right page.
    return isOpen ? <AnimalBookPages {...props} /> : null;
}

function AnimalBookPages({ onClose, discoveredAnimals = [], fedAnimals = {}, onPageTurn, focusEntry, onEntryViewed }) {
    useLanguage();
    const scale = useStageScale();
    const entries = ANIMAL_METADATA;
    const [selectedName, setSelectedName] = useState(() => focusEntry || entries[0].name);

    const index = Math.max(0, entries.findIndex((entry) => entry.name === selectedName));
    const entry = entries[index];
    const found = discoveredAnimals.includes(entry.name);
    const fed = Boolean(fedAnimals[entry.name]);
    const category = BOOK_CATEGORIES.find((item) => item.id === entry.category) || BOOK_CATEGORIES[0];
    const sameKind = useMemo(() => entries.filter((item) => item.category === entry.category), [entries, entry.category]);
    const foundCount = entries.filter((item) => discoveredAnimals.includes(item.name)).length;

    const pick = useCallback((name) => {
        if (name === selectedName) return;
        onPageTurn?.();
        setSelectedName(name);
    }, [onPageTurn, selectedName]);

    const step = useCallback((direction) => {
        const next = entries[(index + direction + entries.length) % entries.length];
        pick(next.name);
    }, [entries, index, pick]);

    // Reading a page that the player has discovered counts as viewing it.
    useEffect(() => {
        if (found) onEntryViewed?.(entry.name);
    }, [found, entry.name, onEntryViewed]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'ArrowLeft') step(-1);
            else if (event.key === 'ArrowRight') step(1);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [step]);

    const facts = [
        ['Home', entry.habitat],
        ['Food', entry.diet],
        ['Is', entry.behavior],
        ['Safety', entry.status],
    ];

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

                <div className="zb-cover" />

                {/* Left page: the chosen animal */}
                <section className="zb-page zb-page--left" aria-live="polite">
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
                    <p className="zb-note zb-note--count">{t('You found {found} of {total} animals!', { found: foundCount, total: entries.length })}</p>
                </section>

                {/* Rings */}
                <div className="zb-rings" aria-hidden="true">
                    {[0, 1, 2, 3].map((ring) => <span key={ring} className="zb-ring" />)}
                </div>

                {/* Right page: fun fact and the animal picker */}
                <section className="zb-page zb-page--right">
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
                                    found={discoveredAnimals.includes(item.name)}
                                    fed={Boolean(fedAnimals[item.name])}
                                    onPick={pick}
                                />
                            ))}
                        </div>
                    </aside>
                </section>

                <button type="button" className="zb-arrow zb-arrow--prev" onClick={() => step(-1)} aria-label={t('Previous page')} data-ui-button="true">&#10094;</button>
                <button type="button" className="zb-arrow zb-arrow--next" onClick={() => step(1)} aria-label={t('Next page')} data-ui-button="true">&#10095;</button>
                <p className="zb-counter" aria-live="polite">{t('{page} of {total}', { page: index + 1, total: entries.length })}</p>

                <button type="button" className="zb-close" onClick={onClose} aria-label={t('Close')} data-ui-button="true">&times;</button>
            </div>
        </div>
    );
}
