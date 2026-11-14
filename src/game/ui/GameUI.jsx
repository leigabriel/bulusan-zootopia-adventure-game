/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import * as THREE from 'three';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { ActionButton, ModalShell, PaginationControls, SurfacePanel, cx, useModalTransition } from './UIComponents.jsx';
import { createGLTFLoader } from '../utils/gltfLoader.js';
import { applyHumanSkinColor } from '../utils/characterMaterials.js';
import { ControlsContent } from './ControlsGuide.jsx';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../utils/storage.js';
import { getPlayerProfile, isPlayerProfileComplete, PLAYER_GENDERS, savePlayerProfile } from '../utils/playerProfile.js';

const SETTINGS_CHANGE_EVENT = 'minizoo-settings-changed';

const SFX_FILES = {
    tap: '/audio/click.mp3',
    feed: '/audio/feed.wav',
    confirm: '/audio/click.mp3',
    'task-complete': '/audio/finish-task.mp3',
    'page-turn': '/audio/book-page-turning.mp3',
    'task-list': '/audio/task-list-button.mp3',
};

const uiAudioTemplates = {};

// Settings live in storage.js so the HUD, menus and game loop share one source
// of defaults and one storage key.
function readSettings() {
    try {
        return getSettings();
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}
function persistSettings(updated) {
    try {
        saveSettings(updated);
        window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
    } catch {
        // Storage can be unavailable (private mode); settings stay in memory.
    }
}

function getUIButtonAudioTemplate(kind = 'tap') {
    const src = SFX_FILES[kind] || SFX_FILES.tap;
    if (!uiAudioTemplates[src]) {
        const template = new Audio(src);
        template.preload = 'auto';
        template.volume = 0;
        uiAudioTemplates[src] = template;
        resolveAssetUrl(src).then((url) => {
            if (url) template.src = url;
        }).catch(() => { });
    }
    return uiAudioTemplates[src];
}

function useIsTouchDevice() {
    const [isTouch, setIsTouch] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    });

    useEffect(() => {
        const update = () => {
            setIsTouch(window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
        };

        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return isTouch;
}

function VolumeSliderRow({ label, description, value, onChange }) {
    return (
        <div className="flex w-full flex-col gap-2 rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex justify-between items-center px-1">
                <div className="text-left">
                    <span className="block text-sm font-black uppercase tracking-wider text-slate-800">{label}</span>
                    {description && <span className="block text-[11px] font-semibold text-slate-500">{description}</span>}
                </div>
                <span className="text-xs font-black text-emerald-600">{Math.round(value * 100)}%</span>
            </div>

            <div className="relative mt-1 h-11 flex items-center px-1">
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-full h-11 rounded-full appearance-none bg-transparent cursor-pointer accent-emerald-500 [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:bg-slate-100 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-1.5"
                />
            </div>
        </div>
    );
}

function SelectRow({ label, options = [], value, onChange }) {
    return (
        <div className="flex w-full flex-col gap-2 rounded-2xl border-2 border-slate-100 bg-white p-3 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 px-1">
                {label}
            </span>
            <div className="flex flex-wrap gap-2" role="radiogroup">
                {options.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => onChange(opt.value)}
                            className={cx(
                                 'min-h-11 min-w-24 flex-1 rounded-xl px-2 py-2 text-xs font-black uppercase tracking-wide transition-all',
                                isSelected
                                    ? 'bg-emerald-500 text-white shadow-[0_4px_0_0_#065f46]'
                                    : 'bg-emerald-50 text-emerald-700 shadow-[0_4px_0_0_#d1fae5] hover:bg-emerald-100'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function HowToPlayContent() {
    const [page, setPage] = useState(0);
    const usesTouchControls = Capacitor.isNativePlatform() || /android/i.test(navigator.userAgent || '');
    const pages = usesTouchControls
        ? [
             { label: 'Move', color: 'text-emerald-600', icon: '🕹️', iconClass: 'bg-emerald-100', text: 'Drag the joystick to move.' },
             { label: 'Look and jump', color: 'text-amber-600', icon: '👆', iconClass: 'bg-amber-100', text: 'Swipe to look. Tap Jump to hop.' },
             { label: 'Care for animals', color: 'text-sky-600', icon: '🍎', iconClass: 'bg-sky-100', text: 'Go near a safe animal. Hold Feed.' },
             { label: 'Meet the ranger', color: 'text-emerald-700', icon: '🏅', iconClass: 'bg-lime-100', text: 'Tap Talk. Finish tasks to earn a prize.' },
        ]
        : [
             { label: 'Move and look', color: 'text-emerald-600', icon: 'WASD', iconClass: 'bg-emerald-100 text-xs', text: 'Use WASD to move. Drag the mouse to look.' },
             { label: 'Jump and view', color: 'text-amber-600', icon: 'SPACE', iconClass: 'bg-amber-100 text-[11px]', text: 'Press Space to jump. Press V to change view.' },
             { label: 'Care and talk', color: 'text-sky-600', icon: 'F / T', iconClass: 'bg-sky-100 text-xs', text: 'Hold F to feed. Press T or E to talk.' },
             { label: 'Finish tasks', color: 'text-emerald-700', icon: 'ESC', iconClass: 'bg-lime-100 text-xs', text: 'Press Escape to close. Finish tasks to earn a prize.' },
        ];
    const current = pages[page];

    return (
        <div className="flex min-h-0 flex-col gap-3 text-sm text-slate-700">
            <p className="text-center text-[11px] font-semibold italic">{usesTouchControls ? 'Touch controls' : 'Keyboard and mouse'}</p>
            <div className="flex min-h-20 flex-1 items-center rounded-2xl border-2 border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl', current.iconClass)}>{current.icon}</div>
                    <div>
                        <p className={cx('mb-1 text-[11px] font-black uppercase tracking-wide', current.color)}>{current.label}</p>
                        <p className="font-bold leading-snug text-slate-800">{current.text}</p>
                    </div>
                </div>
            </div>
            <PaginationControls className="sticky bottom-0 bg-white" page={page} pageCount={pages.length} onPageChange={setPage} />
        </div>
    );
}

function CreditsContent() {
    const [page, setPage] = useState(0);
    const modelCredits = [
        ['Tiger', 'Blender Artist', 'https://sketchfab.com/3d-models/tiger-67bbedd727a047869ef7c7b608445484', 'CC-BY-4.0'],
        ['African ostrich (Revised version)', 'Андрей', 'https://sketchfab.com/3d-models/african-ostrich-revised-version-0999e676453e4562a7777cd006125738', 'CC-BY-4.0'],
    ];
    const pageCount = 1 + Math.ceil(modelCredits.length / 2);
    const visibleCredits = page === 0 ? [] : modelCredits.slice((page - 1) * 2, (page - 1) * 2 + 2);

    return (
        <div className="flex min-h-0 flex-col gap-3 text-center text-sm text-slate-700">
            <div className="flex-1 space-y-2 text-left">
                {page === 0 ? (
                    <div className="grid h-full content-center gap-4 text-center">
                        <p className="font-semibold italic">Character and environment assets provided by Quaternius.</p>
                        <a href="https://quaternius.com/" target="_blank" rel="noreferrer" className="mx-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-black uppercase tracking-wider text-white shadow-[0_4px_0_0_#065f46] transition-all active:translate-y-1 active:shadow-none">
                            Quaternius Link
                        </a>
                        <p className="text-xs font-semibold text-slate-500">Additional animal model licenses are listed on the following pages.</p>
                    </div>
                ) : (
                    <><h3 className="text-center text-xs font-black uppercase tracking-widest text-emerald-800">Animal Model Licenses</h3><p className="text-center text-xs font-semibold text-slate-500">CC-BY-4.0 models require author credit. The Birds model uses the Sketchfab Standard license.</p></>
                )}
                {visibleCredits.map(([title, author, source, license]) => (
                    <div key={source} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="font-black text-slate-800">{title}</p>
                        <p className="text-xs font-semibold">By {author} | {license}</p>
                        <a href={source} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-500 px-4 text-[11px] font-black uppercase tracking-wide text-white shadow-[0_3px_0_0_#065f46] transition-all active:translate-y-0.5 active:shadow-none">Link</a>
                    </div>
                ))}
            </div>
            <PaginationControls className="sticky bottom-0 bg-white" page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
    );
}

function ConfirmModal({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel,
    confirmVariant = 'danger',
}) {
    return (
        <ModalShell isOpen={isOpen} onClose={onCancel} title={title} size="sm" footer={<div className="flex justify-end gap-2"><ActionButton variant="secondary" onClick={onCancel}>Back</ActionButton><ActionButton variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</ActionButton></div>}>
            <p className="text-sm font-semibold leading-relaxed text-slate-600">{message}</p>
        </ModalShell>
    );
}

export function playGameButtonSfx(kind = 'tap') {
    const settings = readSettings();
    const volume = settings.uiVolume ?? 1.0;
    if (volume <= 0) return;

    try {
        const template = getUIButtonAudioTemplate(kind);
        const finalSrc = template.currentSrc || template.src || SFX_FILES[kind] || SFX_FILES.tap;
        if (!finalSrc) return;

        const audio = new Audio(finalSrc);
        audio.volume = (kind === 'feed' || kind === 'task-complete' || kind === 'confirm' || kind === 'task-list') ? volume : volume * 0.85;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
        }
    } catch {
    }
}

function Character3DPreview({ modelFile }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!modelFile || !containerRef.current) return;

        const container = containerRef.current;
        let disposed = false;
        let width = container.clientWidth || 300;
        let height = container.clientHeight || 400;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        // Initial position, will be updated by fitCamera
        camera.position.set(0, 1.0, 5.0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(5, 5, 5);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 1.2);
        fill.position.set(-5, 2, -3);
        scene.add(fill);

        let modelGroup = null;

        const fitCamera = () => {
            if (!modelGroup) return;
            const fov = camera.fov * (Math.PI / 180);
            const aspect = Math.max(width / height, 0.1);
            const targetHeight = 1.65;
            const baseDistance = (targetHeight * 0.68) / Math.tan(fov / 2);
            const narrowScreenAdjustment = aspect < 0.7 ? 0.7 / aspect : 1;
            camera.position.set(0, targetHeight * 0.52, baseDistance * narrowScreenAdjustment);
            camera.lookAt(0, targetHeight * 0.5, 0);
            camera.updateProjectionMatrix();
        };

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                width = entry.contentBoxSize?.[0]?.inlineSize || entry.contentRect.width || width;
                height = entry.contentBoxSize?.[0]?.blockSize || entry.contentRect.height || height;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
                fitCamera();
            }
        });
        resizeObserver.observe(container);

        let mixer = null;
        let idleAction = null;
        let animationId = null;

        resolveAssetUrl(`/models/characters/${modelFile}`)
            .then((url) => {
                if (!url || disposed) return;
                const loader = createGLTFLoader();
                loader.load(url, (gltf) => {
                    if (disposed) {
                        gltf.scene.traverse((child) => {
                            if (!child.isMesh) return;
                            child.geometry?.dispose();
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach((material) => material?.dispose());
                        });
                        return;
                    }
                    modelGroup = gltf.scene;

                    applyHumanSkinColor(modelGroup);

                    // Every preview uses the same world-space height and camera framing.
                    const box = new THREE.Box3().setFromObject(modelGroup);
                    const size = box.getSize(new THREE.Vector3());
                    const targetHeight = 1.65;
                    const scale = targetHeight / Math.max(size.y, 0.001);
                    modelGroup.scale.set(scale, scale, scale);
                    const fittedBox = new THREE.Box3().setFromObject(modelGroup);
                    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
                    modelGroup.position.x -= fittedCenter.x;
                    modelGroup.position.z -= fittedCenter.z;
                    modelGroup.position.y -= fittedBox.min.y;

                    if (gltf.animations && gltf.animations.length > 0) {
                        mixer = new THREE.AnimationMixer(modelGroup);
                        const actions = {};
                        gltf.animations.forEach((clip) => {
                            actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                        });
                        const actionEntries = Object.entries(actions);
                        idleAction = actions.idle || actionEntries.find(([name]) => /idle|stand|breath/.test(name))?.[1] || actionEntries[0]?.[1] || null;
                        if (idleAction) {
                            idleAction.enabled = true;
                            idleAction.setEffectiveWeight(1);
                            idleAction.play();
                        }
                    }

                    mixer?.update(0.1);
                    scene.add(modelGroup);
                    fitCamera();

                    const clock = new THREE.Clock();
                    const animate = () => {
                        if (disposed) return;
                        if (modelGroup) modelGroup.rotation.y += 0.004;
                        if (mixer && clock) mixer.update(clock.getDelta());
                        renderer.render(scene, camera);
                        animationId = requestAnimationFrame(animate);
                    };
                    animate();
                }, undefined, () => { });
            })
            .catch(() => { });

        return () => {
            disposed = true;
            if (animationId) cancelAnimationFrame(animationId);
            if (mixer) {
                mixer.stopAllAction();
                mixer = null;
            }
            idleAction = null;
            resizeObserver.disconnect();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            if (modelGroup) scene.remove(modelGroup);
            if (modelGroup) {
                modelGroup.traverse((child) => {
                    if (!child.isMesh) return;
                    child.geometry?.dispose();
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => material?.dispose());
                });
            }
        };
    }, [modelFile]);

    return (
        <div
            ref={containerRef}
            className="h-full w-full"
        />
    );
}

function SettingsModal({ isOpen, onClose, onQuit, cameraMode, onCameraModeChange, inGame = false }) {
    const [settings, setSettings] = useState(() => readSettings());
    const [activeSection, setActiveSection] = useState(null);

    const handleVolumeChange = (key, val) => {
        const next = { ...settings, [key]: val };
        setSettings(next);
        persistSettings(next);
    };

    const updateSetting = (key, value) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        persistSettings(next);
    };

    const sectionTitles = {
        graphics: 'Graphics',
        audio: 'Audio',
        sensitivity: 'Sensitivity',
        perspective: 'View Perspective',
        controls: 'How To Control',
    };

    if (activeSection) {
        return (
            <ModalShell isOpen={isOpen && Boolean(activeSection)} onClose={() => setActiveSection(null)} title={sectionTitles[activeSection]} size={activeSection === 'controls' ? 'xl' : 'md'}>
                <div className="flex min-h-0 flex-col gap-3">
                    <ActionButton variant="secondary" size="sm" className="self-start" onClick={() => setActiveSection(null)}>
                        <span aria-hidden="true">&lsaquo;</span> Settings
                    </ActionButton>

                    {activeSection === 'graphics' ? (
                        <div className="grid flex-1 content-center">
                            <SelectRow
                                label="Graphics Quality"
                                options={[
                                    { label: 'Low', value: 'low' },
                                    { label: 'Medium', value: 'medium' },
                                    { label: 'High', value: 'high' },
                                ]}
                                value={settings.graphicsQuality || 'medium'}
                                onChange={(value) => updateSetting('graphicsQuality', value)}
                            />
                        </div>
                    ) : null}

                    {activeSection === 'controls' ? <ControlsContent /> : null}

                    {activeSection === 'audio' ? (
                        <div className="grid flex-1 content-center gap-3 min-[568px]:grid-cols-2">
                            <VolumeSliderRow label="Music" description="Background" value={settings.musicVolume ?? 0.5} onChange={(value) => handleVolumeChange('musicVolume', value)} />
                            <VolumeSliderRow label="Ambience" description="Nature" value={settings.ambienceVolume ?? 1} onChange={(value) => handleVolumeChange('ambienceVolume', value)} />
                            <VolumeSliderRow label="SFX" description="Animals" value={settings.sfxVolume ?? 1} onChange={(value) => handleVolumeChange('sfxVolume', value)} />
                            <VolumeSliderRow label="UI" description="Buttons" value={settings.uiVolume ?? 1} onChange={(value) => handleVolumeChange('uiVolume', value)} />
                        </div>
                    ) : null}

                    {activeSection === 'sensitivity' ? (
                        <div className="grid flex-1 content-center">
                            <SelectRow
                                label="Look Sensitivity"
                                options={[
                                    { label: 'Slow', value: 0.5 },
                                    { label: 'Normal', value: 1 },
                                    { label: 'Fast', value: 1.8 },
                                ]}
                                value={settings.sensitivity ?? 1}
                                onChange={(value) => updateSetting('sensitivity', value)}
                            />
                        </div>
                    ) : null}

                    {activeSection === 'perspective' ? (
                        <div className="grid flex-1 content-center">
                            <SelectRow
                                label="Camera View"
                                options={[
                                    { label: 'First Person', value: 'first' },
                                    { label: 'Third Person', value: 'third' },
                                ]}
                                value={cameraMode || settings.cameraMode || 'third'}
                                onChange={(value) => {
                                    updateSetting('cameraMode', value);
                                    onCameraModeChange?.(value);
                                }}
                            />
                        </div>
                    ) : null}
                </div>
            </ModalShell>
        );
    }

    const categories = [
        ...(inGame ? [{ id: 'resume', label: 'Resume', icon: '▶', className: 'border-emerald-400 bg-emerald-500 text-white' }] : []),
        { id: 'graphics', label: 'Graphics', icon: '▣', className: 'border-sky-200 bg-white text-slate-800' },
        { id: 'audio', label: 'Audio', icon: '♪', className: 'border-violet-200 bg-white text-slate-800' },
        { id: 'sensitivity', label: 'Look Speed', icon: '↔', className: 'border-amber-200 bg-white text-slate-800' },
        { id: 'perspective', label: 'Camera View', icon: '◉', className: 'border-teal-200 bg-white text-slate-800' },
        { id: 'controls', label: 'Controls', icon: '✥', className: 'border-lime-200 bg-white text-slate-800' },
        ...(inGame && onQuit ? [{ id: 'quit', label: 'Quit', icon: '×', className: 'border-rose-200 bg-rose-50 text-rose-700' }] : []),
    ];

    return (
        <ModalShell isOpen={isOpen && !activeSection} onClose={onClose} title="Game Settings" size="md">
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5 w-full">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                                if (category.id === 'resume') onClose();
                                else if (category.id === 'quit') onQuit?.();
                                else setActiveSection(category.id);
                            }}
                            className={cx(
                                'flex min-h-12 w-full items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-left font-black text-sm shadow-[0_3px_0_0_#dbe4ea] transition-all active:translate-y-1 active:shadow-none',
                                category.className
                            )}
                        >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100/80 text-base" aria-hidden="true">{category.icon}</span>
                            <span className="min-w-0 flex-1">{category.label}</span>
                            {category.id !== 'resume' && category.id !== 'quit' ? <span aria-hidden="true">›</span> : null}
                        </button>
                    ))}
                </div>
            </div>
        </ModalShell>
    );
}

export function PlayerDetailsModal({ isOpen, onClose, onSave, required = false }) {
    const storedProfile = getPlayerProfile();
    const [name, setName] = useState(storedProfile.name);
    const [gender, setGender] = useState(storedProfile.gender);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const submit = () => {
        const profile = savePlayerProfile({ name, gender });
        if (!profile) {
            setError('Enter your name and choose a character.');
            return;
        }
        playGameButtonSfx('confirm');
        onSave?.(profile);
        onClose?.();
    };

    return (
        <ModalShell
            isOpen={true}
            onClose={onClose}
            closeOnBackdrop={!required}
            showClose={!required}
            title={storedProfile.name ? 'Player Details' : 'Welcome, Explorer!'}
            size="md"
            footer={<ActionButton className="w-full" onClick={submit}>Save</ActionButton>}
        >
            <div className="grid min-[568px]:grid-cols-[1.2fr_1fr] gap-3">
                <div className="flex flex-col justify-center">
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-emerald-700" htmlFor="player-ign">Player name</label>
                    <input id="player-ign" type="text" maxLength={24} value={name} onChange={(event) => { setName(event.target.value); setError(''); }} className="block min-h-11 w-full rounded-xl border-2 border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-emerald-400 focus:bg-white" placeholder="Your name" autoFocus />
                    {error ? <p className="mt-2 text-[11px] font-black text-rose-600" role="alert">{error}</p> : null}
                </div>
                <fieldset className="min-w-0">
                    <legend className="mb-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">Choose a character</legend>
                    <div className="grid grid-cols-2 gap-2 w-full">
                        {PLAYER_GENDERS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={gender === option.id}
                                onClick={() => { setGender(option.id); setError(''); }}
                                className={cx(
                                    'flex w-full min-h-11 items-center justify-center rounded-xl border-2 px-2 py-2 text-sm font-black transition-all active:translate-y-1',
                                    gender === option.id ? 'border-emerald-600 bg-emerald-500 text-white shadow-[0_3px_0_0_#065f46]' : 'border-emerald-100 bg-white text-slate-700 shadow-sm'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            </div>
        </ModalShell>
    );
}

// REDESIGNED MAIN MENU - REAL 3D BUTTONS & AESTHETIC BUSHES

export function MainMenu({ onStart, onMenuInteraction, onProfileSaved, isVisible }) {
    const [starting, setStarting] = useState(false);
    const [howToPlayOpen, setHowToPlayOpen] = useState(false);
    const [creditsOpen, setCreditsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);
    const [profileRequired, setProfileRequired] = useState(false);
    const startAfterProfileRef = useRef(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => {
        let listenerHandle = null;
        let disposed = false;
        const setupBack = async () => {
            try {
                listenerHandle = await CapacitorApp.addListener('backButton', () => {
                    if (showExitConfirm) {
                        setShowExitConfirm(false);
                        return;
                    }
                    if (howToPlayOpen) {
                        setHowToPlayOpen(false);
                        return;
                    }
                    if (creditsOpen) {
                        setCreditsOpen(false);
                        return;
                    }
                    if (settingsOpen) {
                        setSettingsOpen(false);
                        return;
                    }
                    if (playerDetailsOpen) {
                        setPlayerDetailsOpen(false);
                        return;
                    }
                    setShowExitConfirm(true);
                });
                // Effect re-ran while the listener was registering: drop the stale one.
                if (disposed) {
                    listenerHandle.remove();
                    listenerHandle = null;
                }
            } catch {
            }
        };
        setupBack();
        return () => {
            disposed = true;
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, [showExitConfirm, howToPlayOpen, creditsOpen, settingsOpen, playerDetailsOpen]);

    const handleStart = useCallback(() => {
        if (!isPlayerProfileComplete()) {
            startAfterProfileRef.current = true;
            setProfileRequired(true);
            setPlayerDetailsOpen(true);
            return;
        }
        playGameButtonSfx('confirm');
        setStarting(true);
        onStart();
    }, [onStart]);

    const handleProfileSaved = useCallback((profile) => {
        onProfileSaved?.(profile);
        if (startAfterProfileRef.current) {
            startAfterProfileRef.current = false;
            setStarting(true);
            onStart();
        }
    }, [onProfileSaved, onStart]);

    if (!isVisible) return null;

    return (
        <div
            onPointerDownCapture={onMenuInteraction}
            className={cx(
                "main-menu fixed inset-0 z-40 flex flex-col items-center justify-between overflow-hidden select-none touch-none bg-emerald-900 transition-all duration-400 ease-in-out py-3 px-4",
                starting ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
            )}
        >
            {/* Background Hills and Sky */}
            <div className="absolute -inset-x-20 inset-y-0 z-0 bg-linear-to-b from-[#70e0ff] via-[#a2d2ff] to-[#c6fe69] pointer-events-none" aria-hidden="true">
                <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_70%)] animate-pulse" />

                {/* Floating Clouds */}
                <div className="absolute top-[5%] left-[6%] w-20 sm:w-36 h-6 sm:h-10 bg-white/70 rounded-full blur-[0.5px] animate-[kids-float_6s_ease-in-out_infinite]" />
                <div className="absolute top-[9%] right-[8%] w-28 sm:w-48 h-8 sm:h-12 bg-white/60 rounded-full blur-[0.5px] animate-[kids-float_8s_ease-in-out_infinite_1s]" />

                {/* Rolling Green Hills */}
                <div className="absolute bottom-0 w-full h-[42%] bg-[#c6fe69] rounded-t-[100%] scale-[1.7] translate-y-1/3 shadow-[0_-12px_24px_rgba(0,0,0,0.05)]" />
                <div className="absolute bottom-0 w-full h-[27%] bg-[#70e000] rounded-t-[100%] scale-[1.4] translate-y-1/4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]" />
                <div className="absolute bottom-0 w-full h-[14%] bg-[#38b000] rounded-t-[100%] scale-[1.2] translate-y-1/4 shadow-[0_-8px_16px_rgba(0,0,0,0.05)]" />
            </div>

            {/* Main Interface Content Container */}
            <div className="relative z-30 flex h-full w-full max-w-xl flex-col items-center justify-center pointer-events-auto safe-area-inset py-1">

                {/* 1. TOP TITLE BANNER */}
                <div className="menu-title-wrap w-full flex justify-center pt-0 shrink-0 origin-top">
                    <WoodenTitle titlePart1="Bulusan" titlePart2="Zootopia Adventure Game" />
                </div>

                {/* 2. CENTER STACKED PRIMARY ACTION BUTTONS */}
                <div className="menu-primary w-full max-w-sm flex flex-col items-center gap-1 my-auto py-0.5">

                    {/* PLAY GAME */}
                    <button
                        type="button"
                        onClick={handleStart}
                        disabled={starting}
                        className="menu-primary-button group flex min-h-11 items-center justify-center gap-2.5 px-4 transition-transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        <img src="/ui-buttons/play-button.png" alt="Play" className="menu-primary-icon object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        <span className="menu-primary-label font-black uppercase text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                            PLAY
                        </span>
                    </button>

                    {/* SETTINGS */}
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="menu-primary-button group flex min-h-11 items-center justify-center gap-2.5 px-4 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <img src="/ui-buttons/settings-button.png" alt="Settings" className="menu-primary-icon object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        <span className="menu-primary-label font-black uppercase text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                            SETTINGS
                        </span>
                    </button>

                    {/* QUIT */}
                    <button
                        type="button"
                        onClick={() => setShowExitConfirm(true)}
                        className="menu-primary-button group flex min-h-11 items-center justify-center gap-2.5 px-4 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <img src="/ui-buttons/quit-button.png" alt="Quit" className="menu-primary-icon object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        <span className="menu-primary-label font-black uppercase text-slate-800 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]">
                            QUIT
                        </span>
                    </button>
                </div>
            </div>

            {/* BOTTOM BAR: LEFT = 3 UI BUTTONS (GUIDE, PLAYER, CREDITS), RIGHT = VERSION ONLY */}
            <div className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+0.35rem)] z-40 flex items-end justify-between">
                {/* 3 UI BUTTONS IN BOTTOM LEFT */}
                <div className="flex items-center gap-2.5 sm:gap-4">
                    {/* HOW TO PLAY / GUIDE */}
                    <button
                        type="button"
                        onClick={() => setHowToPlayOpen(true)}
                        className="menu-secondary-button group relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform active:scale-90"
                        title="How To Play"
                    >
                        <img src="/ui-buttons/how-to-play-button.png" alt="How To Play" className="h-8 w-8 sm:h-11 sm:w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
                        <span className="text-[11px] font-black uppercase tracking-wide text-emerald-950 drop-shadow-xs">
                            Guide
                        </span>
                    </button>

                    {/* PLAYER DETAILS */}
                    <button
                        type="button"
                        onClick={() => { setProfileRequired(false); setPlayerDetailsOpen(true); }}
                        className="menu-secondary-button group relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform active:scale-90"
                        title="Player Details"
                    >
                        <img src="/ui-buttons/character-button.png" alt="Player Details" className="h-8 w-8 sm:h-11 sm:w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
                        <span className="text-[11px] font-black uppercase tracking-wide text-emerald-950 drop-shadow-xs">
                            Player
                        </span>
                    </button>

                    {/* CREDITS */}
                    <button
                        type="button"
                        onClick={() => setCreditsOpen(true)}
                        className="menu-secondary-button group relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform active:scale-90"
                        title="Credits"
                    >
                        <img src="/ui-buttons/credit-button.png" alt="Credits" className="h-8 w-8 sm:h-11 sm:w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
                        <span className="text-[11px] font-black uppercase tracking-wide text-emerald-950 drop-shadow-xs">
                            Credits
                        </span>
                    </button>
                </div>

                {/* VERSION ONLY IN BOTTOM RIGHT */}
                <div className="pb-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-950/70 drop-shadow-xs">
                    <span>VERSION {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0'}</span>
                </div>
            </div>

            {/* Modals */}
            <ModalShell isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} title="How To Play" size="md">
                <HowToPlayContent />
            </ModalShell>

            <ModalShell isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} title="Credits" size="md">
                <CreditsContent />
            </ModalShell>

            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

            {playerDetailsOpen ? <PlayerDetailsModal isOpen={true} required={profileRequired} onClose={() => setPlayerDetailsOpen(false)} onSave={handleProfileSaved} /> : null}

            <ConfirmModal
                isOpen={showExitConfirm}
                onConfirm={() => {
                    setShowExitConfirm(false);
                    if (Capacitor.isNativePlatform()) {
                        try {
                            CapacitorApp.exitApp();
                        } catch (e) {
                            console.error("Error exiting app:", e);
                            if (window.navigator && window.navigator.app && window.navigator.app.exitApp) {
                                window.navigator.app.exitApp();
                            }
                        }
                    }
                }}
                onCancel={() => setShowExitConfirm(false)}
                title="Exit Game?"
                message="Are you sure you want to exit? Your progress will be safely saved!"
                confirmLabel="Exit"
                confirmVariant="danger"
            />
        </div>
    );
}

// CARVED WOODEN BANNER TITLE

const WoodenTitle = ({ titlePart1, titlePart2, className = '' }) => {
    return (
        <div className={cx("relative flex flex-col items-center select-none", className)}>
            {/* Wooden Ropes - Long enough to hang from the top of the screen regardless of scale */}
            <div className="absolute -top-250 left-1/4 w-1 sm:w-1.5 h-255 bg-[#3d2314] rounded-full z-0 opacity-90 shadow-sm" />
            <div className="absolute -top-250 right-1/4 w-1 sm:w-1.5 h-255 bg-[#3d2314] rounded-full z-0 opacity-90 shadow-sm" />

            {/* Cedar Wooden Board */}
            <div className="wooden-title relative z-10 bg-linear-to-b from-[#7f4f24] to-[#582f0e] border-4 border-[#6c3a11] rounded-2xl shadow-[0_8px_0_0_#3d2314] px-6 py-2 text-center overflow-hidden">
                {/* Wood Grain Pattern (CSS) */}
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                     style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.5) 20px, rgba(0,0,0,0.5) 21px)' }} />

                {/* Title Text */}
                <h1 className="relative z-20 flex flex-col items-center justify-center">
                    <span
                        className="wooden-title-main leading-none font-black text-[#ffd166] tracking-tight uppercase"
                        style={{
                            WebkitTextStroke: '1px #ffffff',
                            textShadow: '0 3px 0 #9e2a2b, 0 6px 12px rgba(0,0,0,0.5)',
                        }}
                    >
                        {titlePart1}
                    </span>
                    <span
                        className="wooden-title-sub leading-none font-black text-[#90e0ef] tracking-wide uppercase mt-0.5"
                        style={{
                            WebkitTextStroke: '1px #ffffff',
                            textShadow: '0 2px 0 #1d3557, 0 4px 8px rgba(0,0,0,0.5)',
                        }}
                    >
                        {titlePart2}
                    </span>
                </h1>
            </div>
        </div>
    );
};

function DirectionArrow({ direction }) {
    return (
        <svg viewBox="0 0 24 24" className={cx('sz-nudge h-6 w-6 shrink-0', direction < 0 ? '-scale-x-100' : '')} aria-hidden="true">
            <path d="M5 12h12m-5-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/**
 * MissionCard: the one way a story task is shown. The HUD indicator (compact)
 * and the task panel (full) use this same card, so a child sees the same
 * number badge, title, progress chip and arrow in both places.
 */
export function MissionCard({ task, status = '', navigation, variant = 'compact', expanded = false, onToggle, guidanceEnabled, onToggleGuidance, onOpenTasks }) {
    if (!task) return null;
    const full = variant === 'full';
    const showArrow = navigation && navigation.onScreen === false && navigation.direction;
    const distance = navigation?.distance != null ? `${navigation.distance} m` : '';
    const chipText = status || distance;
    const open = full || expanded;

    const header = (
        <>
            <span className="sz-badge h-10! w-10! text-base!">{task.number}</span>
            <span className="min-w-0 flex-1 text-left">
                <span className="sz-label block text-[14px]! leading-none">Task {task.number} of 30</span>
                <span className={cx('block font-black leading-tight text-(--sz-ink)', full ? 'text-[18px]' : 'truncate text-[16px]')}>{task.title}</span>
            </span>
            {chipText ? <span className="sz-chip sz-chip--sun shrink-0">{chipText}</span> : null}
            {showArrow ? <span className="shrink-0 text-(--sz-green-deep)"><DirectionArrow direction={navigation.direction} /></span> : null}
            {!full ? <span className="shrink-0 text-(--sz-ink-soft) text-lg font-black" aria-hidden="true">{expanded ? '▴' : '▾'}</span> : null}
        </>
    );

    return (
        <div className={cx('sz-mission overflow-hidden', full ? '' : 'w-[min(62vw,26rem)]')} data-ui-panel="true">
            {full ? (
                <div className="flex items-center gap-2 px-3 py-2">{header}</div>
            ) : (
                <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} current task`} className="flex min-h-14 w-full items-center gap-2 px-3 py-1.5">{header}</button>
            )}
            {open ? (
                <div className="border-t-2 border-(--sz-sun)/60 bg-(--sz-sun-tint) px-3 py-2">
                    <p className="sz-text text-[15px]! leading-snug">{task.instruction}</p>
                    {!full ? (
                        <div className="mt-2 flex gap-2">
                            <button type="button" data-ui-button="true" onClick={onToggleGuidance} className="sz-btn sz-btn--sm sz-btn--ghost flex-1" aria-pressed={guidanceEnabled}>{guidanceEnabled ? 'Guide: On' : 'Guide: Off'}</button>
                            <button type="button" data-ui-button="true" onClick={onOpenTasks} className="sz-btn sz-btn--sm sz-btn--sun flex-1">All Tasks</button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function GameHUD({ playerName, onMenuClick, onPlayerDetails, onTasksClick, onBook, onCamera, currentTask, taskProgress, missionItem, navigation, guidanceEnabled, onToggleGuidance }) {
    const menuIcon = '/ui-buttons/settings-button.png';
    const taskIcon = '/ui-buttons/task-list-button.png';
    const [taskTrackerOpen, setTaskTrackerOpen] = useState(false);
    const [taskCardVisible, setTaskCardVisible] = useState(() => {
        try { return localStorage.getItem('zoo-task-card-visible') !== '0'; } catch { return true; }
    });
    const setCardVisible = (visible) => {
        setTaskCardVisible(visible);
        if (!visible) setTaskTrackerOpen(false);
        try { localStorage.setItem('zoo-task-card-visible', visible ? '1' : '0'); } catch { /* storage unavailable */ }
    };

    return (
        <div className="hud-top-layout pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-65 select-none">
            <div className="flex w-full items-start justify-between gap-2">

                {/* Left: menu + player, with the current task right underneath */}
                <div className="flex min-w-0 flex-col items-start gap-2">
                    <div className="pointer-events-auto flex min-w-0 items-center gap-2" data-ui-hud="true">
                        <button type="button" onClick={onMenuClick} className="sz-icon-btn" aria-label="Menu" data-ui-button="true">
                            <img src={menuIcon} alt="" />
                        </button>
                        <button type="button" onClick={onPlayerDetails} aria-label="Edit player details" className="hud-player-pill sz-card flex min-h-12 min-w-0 items-center gap-2 rounded-2xl! px-3 shadow-none! active:scale-95" data-ui-button="true">
                            <span className="h-3 w-3 shrink-0 rounded-full bg-(--sz-green)" />
                            <span className="max-w-32 truncate text-[16px] font-black">{playerName || 'Explorer'}</span>
                        </button>
                    </div>
                    {currentTask ? (
                        <div className="mission-tracker pointer-events-auto flex items-start gap-1.5" data-ui-hud="true">
                            {taskCardVisible ? (
                                <>
                                    <MissionCard
                                        task={currentTask}
                                        status={missionItem || taskProgress}
                                        navigation={navigation}
                                        expanded={taskTrackerOpen}
                                        onToggle={() => setTaskTrackerOpen((open) => !open)}
                                        guidanceEnabled={guidanceEnabled}
                                        onToggleGuidance={onToggleGuidance}
                                        onOpenTasks={onTasksClick}
                                    />
                                    <button type="button" data-ui-button="true" onClick={() => setCardVisible(false)} aria-label="Hide current task" className="sz-icon-btn sz-icon-btn--round h-9! w-9! min-h-0! text-base!">&times;</button>
                                </>
                            ) : (
                                <button type="button" data-ui-button="true" onClick={() => setCardVisible(true)} aria-label="Show current task" className="sz-mission flex min-h-12 items-center gap-2 px-2.5 py-1">
                                    <span className="sz-badge h-8! w-8! text-sm!">{currentTask.number}</span>
                                    <span className="sz-label text-[14px]!">Task</span>
                                    <span className="text-lg font-black text-(--sz-ink-soft)" aria-hidden="true">▾</span>
                                </button>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Right: tasks */}
                <div className="pointer-events-auto flex flex-col items-end gap-2" data-ui-hud="true">
                    <button type="button" onClick={onTasksClick} className="sz-icon-btn" aria-label="Tasks" data-ui-button="true" data-sfx-self="true">
                        <img src={taskIcon} alt="" />
                    </button>
                </div>
            </div>

            {/* Bottom centre: exploration tools, icon + word so they read without guessing */}
            <div className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-65 flex -translate-x-1/2 items-center gap-2" data-ui-hud="true" aria-label="Exploration tools">
                <button type="button" onClick={onBook} className="sz-icon-btn w-[72px]!" aria-label="Open Animal Book" data-ui-button="true">
                    <img src="/ui-buttons/book-button.png" alt="" />
                    <span className="text-[14px] leading-none">Book</span>
                </button>
                <button type="button" onClick={onCamera} className="sz-icon-btn w-[72px]!" aria-label="Take a photo" data-ui-button="true">
                    <img src="/ui-buttons/camera-button.png" alt="" />
                    <span className="text-[14px] leading-none">Photo</span>
                </button>
            </div>
        </div>
    );
}

export function SettingsPanel({ isOpen, onClose, onQuit, cameraMode, onCameraModeChange }) {
    return (
        <SettingsModal
            isOpen={isOpen}
            inGame={true}
            onClose={onClose}
            onQuit={onQuit}
            cameraMode={cameraMode}
            onCameraModeChange={onCameraModeChange}
        />
    );
}

export function TaskPanel({ isOpen, onClose, tasks = [], storyTasks = [], activeTaskId, taskProgress = '', onTaskClick, onResetTasks, onViewCertificate }) {
    const { mounted, active } = useModalTransition(isOpen, 300);
    const [tab, setTab] = useState('story');

    const fedCount = tasks.filter((task) => task.completed).length;
    const storyDone = storyTasks.filter((task) => task.completed).length;
    const activeTask = storyTasks.find((task) => task.id === activeTaskId) || null;
    const showingStory = tab === 'story';
    const done = showingStory ? storyDone : fedCount;
    const total = showingStory ? storyTasks.length : tasks.length;
    const percent = (done / (total || 1)) * 100;

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-[var(--ui-edge-gap)] pt-[max(var(--ui-edge-gap),env(safe-area-inset-top))] pr-[max(var(--ui-edge-gap),env(safe-area-inset-right))] pb-[max(var(--ui-edge-gap),env(safe-area-inset-bottom))] pl-[max(var(--ui-edge-gap),env(safe-area-inset-left))] pointer-events-none" data-ui-modal="true" role="dialog" aria-modal="true" aria-label="Adventure tasks">
            <button
                type="button"
                className={cx('pointer-events-auto fixed inset-0 bg-[#3b2a1a]/45 backdrop-blur-sm transition-opacity duration-300 ease-out', active ? 'opacity-100' : 'opacity-0')}
                onClick={onClose}
                aria-label="Close tasks"
            />

            <section className={cx(
                'sz-card pointer-events-auto relative flex w-[min(94vw,640px)] max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden transition-all duration-300 ease-out',
                active ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            )}>
                <header className="sz-card-header shrink-0">
                    <div className="flex min-w-0 items-center gap-3">
                        <img src="/ui-buttons/task-list-button.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
                        <h2 className="sz-title truncate uppercase">Adventure Tasks</h2>
                    </div>
                    <button type="button" data-ui-button="true" onClick={onClose} aria-label="Close tasks" className="sz-icon-btn sz-icon-btn--round sz-icon-btn--close shrink-0">&times;</button>
                </header>

                <div className="sz-tabs shrink-0" role="tablist" aria-label="Task type">
                    <button type="button" role="tab" aria-selected={showingStory} onClick={() => setTab('story')} className="sz-tab" data-ui-button="true">Story {storyDone}/{storyTasks.length}</button>
                    <button type="button" role="tab" aria-selected={!showingStory} onClick={() => setTab('animals')} className="sz-tab" data-ui-button="true">Feeding {fedCount}/{tasks.length}</button>
                </div>

                <div className="shrink-0 px-3 pb-2">
                    <div className="sz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{ width: `${percent}%` }} /></div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" data-ui-scrollable="true">
                    {showingStory ? (
                        <>
                            {activeTask ? (
                                <div className="mb-3">
                                    <MissionCard task={activeTask} status={taskProgress} variant="full" />
                                </div>
                            ) : (
                                <p className="sz-row sz-row--done mb-3 justify-center">All story tasks done!</p>
                            )}
                            <ol className="grid gap-2">
                                {storyTasks.filter((task) => task.id !== activeTaskId).map((task) => {
                                    const isActive = task.id === activeTaskId;
                                    const state = task.completed ? 'done' : isActive ? 'active' : 'locked';
                                    return (
                                        <li key={task.id} className={cx('sz-row', `sz-row--${state}`)}>
                                            <span className={cx('sz-badge', task.completed ? 'sz-badge--done' : isActive ? '' : 'sz-badge--locked')}>{task.completed ? '✓' : task.number}</span>
                                            <span className="min-w-0 flex-1">{task.title}</span>
                                            <span className="sz-label shrink-0">{task.completed ? 'Done' : isActive ? 'Now' : ''}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </>
                    ) : (
                        <ol className="grid gap-2">
                            {tasks.map((task, index) => (
                                <li key={task.id}>
                                    <button type="button" data-ui-button="true" onClick={() => onTaskClick?.(task)} className={cx('sz-row w-full text-left', task.completed ? 'sz-row--done' : '')}>
                                        <span className={cx('sz-badge', task.completed ? 'sz-badge--done' : '')}>{task.completed ? '✓' : index + 1}</span>
                                        <span className={cx('min-w-0 flex-1', task.completed && 'opacity-70')}>{task.name}</span>
                                        <span className="sz-label shrink-0">{task.completed ? 'Fed' : 'Feed'}</span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>

                {(onViewCertificate || onResetTasks) ? (
                    <footer className="flex shrink-0 items-center justify-end gap-2 border-t-[3px] border-(--sz-line) bg-(--sz-cream-2) p-2">
                        {onResetTasks ? <ActionButton variant="ghost" size="sm" onClick={onResetTasks}>Reset</ActionButton> : null}
                        {onViewCertificate ? <ActionButton variant="warning" size="sm" onClick={onViewCertificate}>Certificate</ActionButton> : null}
                    </footer>
                ) : null}
            </section>
        </div>
    );
}

export function NPCInteractionPrompt({ visible, onInteract, npcName = 'Zoo Staff', isTouchDevice }) {
    if (!visible) return null;

    return (
        <div className="context-prompt pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+5.3rem)] right-[max(5.5rem,calc(env(safe-area-inset-right)+5.5rem))] z-75 flex items-end">
            <SurfacePanel className="pointer-events-auto flex max-w-44 items-center gap-2 border-amber-200 bg-[#fff8df]/95 p-1 shadow-lg" data-ui-panel="true">
                <span className="min-w-0 flex-1 truncate pl-2 text-[11px] font-bold text-slate-600">{npcName || 'Zoo Ranger'}</span>
                <ActionButton variant="warning" className="shrink-0" onClick={onInteract} aria-label={`Talk to ${npcName}`}>
                    <span aria-hidden="true">●</span> Talk{!isTouchDevice ? ' (T)' : ''}
                </ActionButton>
            </SurfacePanel>
        </div>
    );
}

export function ContextActionPrompt({ visible, label, detail, onInteract, keyboardKey = 'E' }) {
    if (!visible) return null;
    return (
        <div className="context-prompt pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+5.3rem)] right-[max(5.5rem,calc(env(safe-area-inset-right)+5.5rem))] z-75 flex flex-col items-end">
            {detail ? <span className="mb-1 max-w-44 rounded-xl bg-emerald-950/90 px-3 py-1 text-center text-[11px] font-bold text-white">{detail}</span> : null}
            <button
                type="button"
                data-ui-button="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onInteract}
                className="pointer-events-auto min-h-11 min-w-24 rounded-xl border-2 border-amber-200 bg-amber-400 px-3 py-2 text-sm font-black text-amber-950 shadow-[0_4px_0_0_#92400e] active:translate-y-1 active:shadow-none touch-none"
            >
                {label} <span className="hidden min-[700px]:inline">({keyboardKey})</span>
            </button>
        </div>
    );
}

export function NPCDialogueModal({ isOpen, npcName, npcRole, message, dialogueProgress, onAdvance }) {
    const openedAtRef = useRef(0);

    useEffect(() => {
        if (isOpen) openedAtRef.current = performance.now();
    }, [isOpen]);

    // Keyboard players can advance with Enter or Space as well as a click.
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== 'Enter' && event.code !== 'Space') return;
            event.preventDefault();
            if (performance.now() - openedAtRef.current < 300) return;
            onAdvance?.();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onAdvance]);

    if (!isOpen) return null;

    const advance = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() - openedAtRef.current < 300) return;
        onAdvance?.();
    };

    return (
        <button
            type="button"
            className="fixed inset-0 z-120 flex cursor-pointer items-end justify-center bg-transparent px-[max(1rem,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+clamp(4.75rem,12dvh,7rem))] text-center touch-none select-none"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={advance}
            aria-label={`${npcName || 'Ranger'} dialogue. Tap to continue.`}
        >
            <span className="mb-2 block w-full max-w-3xl px-3 py-2 text-white [text-shadow:0_2px_4px_rgb(0_0_0),0_0_12px_rgb(0_0_0)]">
                <span className="block text-[11px] font-black uppercase tracking-wide text-amber-300 sm:text-xs">{npcName || 'Zoo Ranger'}{npcRole ? ` - ${npcRole}` : ''}</span>
                <span className="mt-1 block text-base font-black leading-snug sm:text-xl">{message}</span>
                <span className="mt-1 block text-[11px] font-bold text-white/90">{dialogueProgress} | Tap or press Enter to continue</span>
            </span>
        </button>
    );
}

export function FeedingSuccessNotification({ visible, animalName, onHide }) {
    useEffect(() => {
        if (!visible) return undefined;
        const id = window.setTimeout(() => onHide?.(), 1900);
        return () => window.clearTimeout(id);
    }, [visible, onHide]);

    if (!visible) return null;

    return (
        <div className="ui-toast pointer-events-none absolute inset-x-0 z-90 flex justify-center px-3">
            <SurfacePanel className="kids-slide-up rounded-full border-emerald-200 bg-emerald-50 px-4 py-2 text-center">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Animal fed successfully</p>
                <p className="text-sm font-bold text-emerald-900">{animalName || 'Animal'} is happy!</p>
            </SurfacePanel>
        </div>
    );
}

export function AllAnimalsCelebration({ visible, onClose, onViewCertificate, onReplay }) {
    return (
        <ModalShell
            isOpen={visible}
            onClose={onClose}
            title="All Animals Are Fed!"
            size="md"
            footer={<div className="grid grid-cols-2 gap-2 min-[568px]:grid-cols-3"><ActionButton variant="secondary" onClick={onClose}>Continue</ActionButton><ActionButton variant="primary" onClick={onViewCertificate}>Certificate</ActionButton><ActionButton variant="warning" onClick={onReplay}>Replay</ActionButton></div>}
        >
            <div className="space-y-3 text-center">
                <p className="text-sm font-semibold text-slate-700">Great work, explorer. Every animal in Bulusan Zootopia Adventure has been cared for.</p>
            </div>
        </ModalShell>
    );
}

// Draws the certificate to a canvas and downloads it as a PNG. window.print()
// would print the whole game page including the 3D canvas.
function downloadCertificate(playerName, totalAnimals, dateText) {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1600, 1100);
    gradient.addColorStop(0, '#fffbeb');
    gradient.addColorStop(1, '#fff7ed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1600, 1100);
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 14;
    ctx.strokeRect(40, 40, 1520, 1020);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b45309';
    ctx.font = '900 38px sans-serif';
    ctx.fillText('BULUSAN ZOOTOPIA ADVENTURE', 800, 200);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 84px sans-serif';
    ctx.fillText('Awarded To', 800, 380);
    ctx.fillStyle = '#047857';
    ctx.font = '900 100px sans-serif';
    ctx.fillText(playerName, 800, 560, 1300);
    ctx.fillStyle = '#334155';
    ctx.font = '600 44px sans-serif';
    ctx.fillText(`For feeding all ${totalAnimals} animals and completing the zoo mission.`, 800, 720, 1400);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 34px sans-serif';
    ctx.fillText(`Issued ${dateText}`, 800, 900);
    const link = document.createElement('a');
    link.download = 'bulusan-zootopia-certificate.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

export function CertificateModal({ isOpen, onClose, playerName = 'Explorer', totalAnimals = 0 }) {
    const today = useMemo(() => new Date().toLocaleDateString(), []);

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Completion Certificate"
            size="lg"
            footer={<div className="flex justify-end gap-2"><ActionButton variant="secondary" onClick={onClose}>Close</ActionButton><ActionButton variant="primary" onClick={() => downloadCertificate(playerName, totalAnimals, today)}>Save Image</ActionButton></div>}
        >
            <div className="rounded-2xl border-2 border-amber-300 bg-linear-to-br from-amber-50 to-orange-50 p-3 text-center shadow-inner">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Bulusan Zootopia Adventure</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Awarded To</h3>
                <p className="mt-2 text-xl font-black text-emerald-700">{playerName}</p>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                    For feeding all {totalAnimals} animals and completing the zoo mission.
                </p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Issued {today}</p>
            </div>

        </ModalShell>
    );
}

export function QuitModal({ isOpen, onConfirm, onCancel }) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            onConfirm={onConfirm}
            onCancel={onCancel}
            title="Quit Game?"
            message="You can always return and continue feeding tasks from where you left off."
            confirmLabel="Quit"
            confirmVariant="danger"
        />
    );
}

export function ResetTasksModal({ isOpen, onConfirm, onCancel }) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            onConfirm={onConfirm}
            onCancel={onCancel}
            title="Reset All Tasks?"
            message="This resets all 30 story tasks, mission items, observations, story photos, feeding tasks, reward, celebration, and certificate. Your player, settings, controls, saved position, and Animal Book discoveries stay saved."
            confirmLabel="Reset"
            confirmVariant="warning"
        />
    );
}

export function Joystick({ baseRef, stickRef, isTouchDevice }) {
    const detectedTouch = useIsTouchDevice();
    const isTouch = typeof isTouchDevice === 'boolean' ? isTouchDevice : detectedTouch;
    if (!isTouch) return null;

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.7rem)] left-[max(0.625rem,env(safe-area-inset-left))] z-70">
            <div
                ref={baseRef}
                className="pointer-events-auto grid h-28 w-28 place-items-center rounded-full border border-white/35 bg-slate-950/25 touch-none select-none backdrop-blur sm:h-28 sm:w-28"
            >
                <div
                    ref={stickRef}
                    className="h-12 w-12 rounded-full border border-white/50 bg-white/85 shadow sm:h-12 sm:w-12 transition-transform duration-150 ease-out"
                />
            </div>
        </div>
    );
}

export function JumpButton({ jumpRef, isTouchDevice }) {
    const detectedTouch = useIsTouchDevice();
    const isTouch = typeof isTouchDevice === 'boolean' ? isTouchDevice : detectedTouch;
    if (!isTouch) return null;

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.7rem)] right-[max(0.625rem,env(safe-area-inset-right))] z-70">
            <button
                ref={jumpRef}
                type="button"
                className="pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/45 bg-amber-400/95 text-sm font-black uppercase tracking-[0.08em] text-slate-900 shadow-lg active:scale-95 sm:h-16 sm:w-16 sm:text-sm touch-manipulation"
            >
                Jump
            </button>
        </div>
    );
}

export function HoldToFeedControl({
    visible,
    animalName,
    progress = 0,
    isHolding = false,
    completed = false,
    disabled = false,
    message = '',
    onStart,
    onEnd,
}) {
    if (!visible) return null;

    const percentage = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    const label = completed ? 'Fed!' : disabled ? 'Need food' : isHolding ? 'Feeding...' : 'Hold to Feed';

    const handlePressStart = (event) => {
        if (disabled || completed) return;
        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget?.setPointerCapture?.(event.pointerId);
        } catch {}
        onStart?.();
    };

    const handlePressEnd = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onEnd?.();
    };

    return (
        <div className="pointer-events-none absolute left-[75%] top-[57%] z-70 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute bottom-full left-1/2 mb-1.5 flex w-max max-w-48 -translate-x-1/2 flex-col items-center justify-center rounded-2xl border-2 border-emerald-200/80 bg-emerald-950/90 px-3 py-1 text-center text-white shadow-xl backdrop-blur-md">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    {animalName ? `${animalName}` : 'Animal'}
                </span>
                <span className="text-[11px] font-extrabold text-emerald-100">
                    {label}
                </span>
                {message ? <span className="mt-0.5 text-[11px] font-medium leading-snug text-slate-200">{message}</span> : null}
            </div>
            <button
                type="button"
                data-ui-button="true"
                aria-label={`${label}${animalName ? ` ${animalName}` : ''}`}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerCancel={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                onTouchCancel={handlePressEnd}
                className={cx(
                    'pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full border-4 border-white/80 shadow-2xl touch-none select-none transition-transform active:scale-95 cursor-pointer',
                    completed ? 'bg-emerald-500' : disabled ? 'bg-slate-400 opacity-70' : 'bg-emerald-950/90',
                )}
            >
                <span
                    className="absolute -inset-1 rounded-full"
                    style={{ background: `conic-gradient(${completed ? '#22c55e' : '#facc15'} ${percentage}%, rgba(255,255,255,.25) ${percentage}% 100%)`, zIndex: 0 }}
                    aria-hidden="true"
                />
                <span className="absolute inset-1 rounded-full bg-emerald-950/90" aria-hidden="true" />
                {completed ? <span className="relative z-10 text-3xl font-black text-white">✓</span> : <img className="relative z-10 h-9 w-9 pointer-events-none" src="/ui-buttons/feed-button.png" alt="" />}
            </button>
        </div>
    );
}

export function AnimalCaution({ visible }) {
    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.2rem)] z-70 flex justify-center px-3 sm:bottom-24">
            <div className="rounded-2xl border-2 border-red-200 bg-red-950/90 px-4 py-2 text-center text-white shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-300">Caution: Dangerous Animal</p>
                <p className="mt-1 text-[11px] font-bold">Stay back. Do not feed the tiger.</p>
            </div>
        </div>
    );
}
