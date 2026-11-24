const COLORS = ['#ffffff', '#fde047', '#86efac', '#7dd3fc', '#fda4af'];
const COUNT = 9;
const LIFETIME_MS = 620;

/** True when the computed cursor is the plain default arrow (not pointer/text/grab). */
export function isDefaultCursor(cursorValue) {
    const value = String(cursorValue || '').trim().toLowerCase();
    if (!value) return false;
    if (value.includes('cursor-default')) return true;
    return value === 'default' || value === 'auto';
}

function spawnSparkles(layer, x, y) {
    for (let i = 0; i < COUNT; i += 1) {
        const dot = document.createElement('span');
        const size = 5 + Math.random() * 6;
        const angle = (Math.PI * 2 * i) / COUNT + Math.random() * 0.6;
        const distance = 22 + Math.random() * 30;
        const color = COLORS[i % COLORS.length];
        dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:${i % 2 ? '50%' : '2px'};background:${color};box-shadow:0 0 6px ${color};pointer-events:none;will-change:transform,opacity;`;
        layer.appendChild(dot);
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const animation = dot.animate(
            [
                { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
                { transform: `translate(${tx}px,${ty}px) scale(0.2) rotate(${i % 2 ? 180 : -180}deg)`, opacity: 0 },
            ],
            { duration: LIFETIME_MS, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' },
        );
        animation.onfinish = () => dot.remove();
    }
}

/** Installs a window-level click particle burst for the default cursor. Returns a cleanup fn. */
export function installClickSparkles() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;';
    document.body.appendChild(layer);

    const onPointerDown = (event) => {
        if (event.pointerType === 'touch' || event.button !== 0) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        try {
            if (!isDefaultCursor(window.getComputedStyle(target).cursor)) return;
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        } catch {
            return;
        }
        spawnSparkles(layer, event.clientX, event.clientY);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
        window.removeEventListener('pointerdown', onPointerDown, true);
        layer.remove();
    };
}
