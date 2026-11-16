import React, { useRef, useState } from 'react';
import { ActionButton, ModalShell } from './UIComponents.jsx';
import { t, useLanguage } from '../i18n/index.js';

export function CameraModeOverlay({ isOpen, onClose, onCapture }) {
    useLanguage();
    const cameraImgRef = useRef(null);

    if (!isOpen) return null;

    const handleCapture = () => {
        if (!cameraImgRef.current) {
            onCapture?.(null);
            return;
        }
        const rect = cameraImgRef.current.getBoundingClientRect();
        const lcdRect = {
            // Measured against camera.webp: the LCD window spans roughly
            // x 16-63% and y 30-70% of the image.
            x: rect.left + rect.width * 0.16,
            y: rect.top + rect.height * 0.30,
            width: rect.width * 0.474,
            height: rect.height * 0.40
        };
        onCapture?.(lcdRect);
    };

    return (
        <div
            data-ui-touch-pass="true"
            className="camera-overlay fixed inset-0 z-120 flex flex-col justify-between pointer-events-none select-none touch-none"
            aria-label={t('Camera')}
        >
            {/* Top Bar: Title & Top-Right 3D 'X' Close Button */}
            <div className="flex items-center justify-between w-full max-w-5xl mx-auto z-122 pointer-events-auto">
                <div className="flex items-center gap-2 rounded-2xl border-2 border-white/80 bg-slate-900/85 px-4 py-2 backdrop-blur-md shadow-2xl">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">
                        {t('Camera')}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    data-ui-button="true"
                    className="ui-close-button flex items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-2xl shadow-[0_4px_0_0_#9f1239] transition-transform active:scale-95 pointer-events-auto cursor-pointer"
                    aria-label={t('Close')}
                >
                    &times;
                </button>
            </div>

            {/* Center Area: Camera Frame PNG */}
            <div className="relative flex-1 min-h-0 w-full flex items-center justify-center py-2 pointer-events-none z-121">
                <div className="relative max-h-full max-w-full flex items-center justify-center p-2">
                    <img
                        ref={cameraImgRef}
                        src="/images/camera.webp"
                        alt=""
                        className="max-h-[62dvh] max-w-[88vw] object-contain drop-shadow-2xl animate-bounce-subtle pointer-events-none"
                    />
                </div>
            </div>

            {/* Bottom Bar: 3D Button 'CAPTURE' Text */}
            <div className="flex items-center justify-center w-full max-w-md mx-auto pb-2 z-122 pointer-events-auto">
                <button
                    type="button"
                    onClick={handleCapture}
                    data-ui-button="true"
                    className="ui-button-primary group relative flex items-center justify-center gap-2 rounded-2xl bg-linear-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 px-6 text-white font-black text-base shadow-[0_6px_0_0_#9f1239] hover:shadow-[0_4px_0_0_#9f1239] active:shadow-none active:translate-y-1.5 transition-all pointer-events-auto cursor-pointer border-2 border-rose-300/80"
                    aria-label={t('Take Photo')}
                >
                    <img
                        src="/ui-buttons/camera-button.png"
                        alt=""
                        className="h-7 w-7 object-contain group-hover:scale-110 transition-transform pointer-events-none"
                    />
                    <span className="tracking-widest uppercase drop-shadow">
                        {t('TAKE PHOTO')}
                    </span>
                </button>
            </div>
        </div>
    );
}

// Shows the photo that was just taken. Nothing is saved until the player
// presses Save; the result of saving is shown right here.
export function CameraPreview({ dataUrl, onSave, onRetake, onClose }) {
    useLanguage();
    const [status, setStatus] = useState({ photo: '', saving: false, result: null });
    if (!dataUrl) return null;
    const current = status.photo === dataUrl ? status : { photo: dataUrl, saving: false, result: null };

    const handleSave = async () => {
        if (current.saving) return;
        setStatus({ photo: dataUrl, saving: true, result: null });
        const result = await onSave?.();
        setStatus({ photo: dataUrl, saving: false, result: result || null });
    };

    return (
        <ModalShell
            isOpen={true}
            onClose={onClose}
            title="Your Zoo Photo"
            size="md"
            footer={<div className="grid grid-cols-3 gap-2"><ActionButton size="sm" onClick={handleSave} disabled={current.saving}>{current.saving ? t('Saving...') : t('Save')}</ActionButton><ActionButton size="sm" variant="secondary" onClick={onRetake}>{t('Try Again')}</ActionButton><ActionButton size="sm" variant="secondary" onClick={onClose}>{t('Close')}</ActionButton></div>}
        >
            <div className="flex w-full flex-col items-center gap-2">
                <img
                    src={dataUrl}
                    alt={t('Your Zoo Photo')}
                    className="max-h-[42dvh] w-auto max-w-full rounded-xl shadow-2xl border-2 border-amber-100/60"
                />
                {current.result ? (
                    <p role="status" className={`text-center text-sm font-black ${current.result.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t(current.result.message)}
                    </p>
                ) : null}
            </div>
        </ModalShell>
    );
}
