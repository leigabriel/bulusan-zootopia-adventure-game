/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export function cx(...tokens) {
    return tokens.filter(Boolean).join(' ');
}

/**
 * ActionButton: Standard game-style button with 3D chunky shadow
 */
export function ActionButton({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    ...props
}) {
    const variantClasses = {
        primary: 'bg-emerald-500 text-white shadow-[0_4px_0_0_#065f46]',
        secondary: 'bg-white text-slate-900 shadow-[0_4px_0_0_#cbd5e1]',
        danger: 'bg-rose-500 text-white shadow-[0_4px_0_0_#9f1239]',
        warning: 'bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#92400e]',
        ghost: 'bg-emerald-950/70 text-white shadow-[0_4px_0_0_rgba(0,0,0,0.3)]',
    };

    const sizeClasses = {
        sm: 'ui-button-secondary px-3 rounded-xl',
        md: 'ui-button-primary px-5 rounded-xl',
        lg: 'ui-button-primary px-8 rounded-2xl',
    };

    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'ui-action-button inline-flex items-center justify-center gap-2 font-black uppercase transition-all active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-50',
                variantClasses[variant] || variantClasses.primary,
                sizeClasses[size] || sizeClasses.md,
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

/**
 * IconButton: Circular game-style icon button
 */
export function IconButton({ children, className = '', ...props }) {
    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'ui-icon-button inline-flex items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_4px_0_0_#cbd5e1] transition-all active:translate-y-1 active:shadow-none',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

/**
 * GameButton: Specialized large button for menus
 */
export function GameButton({
    children,
    className = '',
    color = 'slate',
    size = 'md',
    ...props
}) {
    const colorClasses = {
        slate: 'bg-white text-slate-900 shadow-[0_6px_0_0_#cbd5e1]',
        dark: 'bg-slate-900 text-white shadow-[0_6px_0_0_#0f172a]',
        emerald: 'bg-emerald-500 text-white shadow-[0_6px_0_0_#065f46]',
        rose: 'bg-rose-500 text-white shadow-[0_6px_0_0_#9f1239]',
        amber: 'bg-amber-500 text-white shadow-[0_6px_0_0_#92400e]',
        sky: 'bg-sky-500 text-white shadow-[0_6px_0_0_#075985]',
    };

    const sizeClasses = {
        sm: 'ui-button-secondary px-4 rounded-xl',
        md: 'ui-button-primary px-8 rounded-2xl',
        lg: 'ui-button-primary px-12 rounded-3xl',
    };

    const colorStyle = colorClasses[color] || colorClasses.slate;
    const sizeStyle = sizeClasses[size] || sizeClasses.md;

    return (
        <button
            type="button"
            className={cx(
                'ui-action-button font-black uppercase transition-all active:translate-y-1 active:shadow-none',
                colorStyle,
                sizeStyle,
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function SurfacePanel({ children, className = '', ...props }) {
    return (
        <div
            data-ui-panel="true"
            className={cx(
                'ui-surface rounded-3xl border-2 border-emerald-100 bg-white shadow-[0_12px_0_0_rgba(5,46,22,0.1)]',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function PaginationControls({
    page,
    pageCount,
    onPageChange,
    previousLabel = 'Previous',
    nextLabel = 'Next',
    className = '',
}) {
    if (pageCount <= 1) return null;

    return (
        <nav className={cx('flex shrink-0 items-center justify-between gap-3', className)} aria-label="Pagination">
            <ActionButton
                size="sm"
                variant="secondary"
                disabled={page <= 0}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
            >
                <span aria-hidden="true">&lsaquo;</span> {previousLabel === 'Previous' ? 'Back' : previousLabel}
            </ActionButton>
            <span className="min-w-16 rounded-full bg-emerald-950 px-3 py-1.5 text-center text-xs font-black text-white shadow-[0_3px_0_0_#022c22]" aria-live="polite">
                {page + 1} of {pageCount}
            </span>
            <ActionButton
                size="sm"
                variant="primary"
                disabled={page >= pageCount - 1}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
            >
                {nextLabel} <span aria-hidden="true">&rsaquo;</span>
            </ActionButton>
        </nav>
    );
}

/**
 * Hook to manage mounted and active state for smooth enter/exit modal transitions.
 */
export function useModalTransition(isOpen, duration = 250) {
    const [mounted, setMounted] = React.useState(isOpen);
    const [active, setActive] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setMounted(true);
            const timer = requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setActive(true);
                });
            });
            return () => cancelAnimationFrame(timer);
        } else {
            setActive(false);
            const timer = setTimeout(() => {
                setMounted(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration]);

    return { mounted, active };
}

export function ModalShell({ isOpen, onClose, title, children, footer = null, size = 'md', closeOnBackdrop = true, showClose = true }) {
    const { mounted, active } = useModalTransition(isOpen, 250);

    if (!mounted) return null;

    const maxWidth = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div
            data-ui-modal="true"
            className="ui-modal-layer fixed inset-0 z-120 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
        >
            <button
                type="button"
                aria-label="Close modal"
                onClick={closeOnBackdrop ? onClose : undefined}
                className={cx(
                    'absolute inset-0 bg-emerald-950/40 backdrop-blur-xs transition-opacity duration-250 ease-out',
                    active ? 'opacity-100' : 'opacity-0'
                )}
            />

            <SurfacePanel
                className={cx(
                    'ui-modal relative z-121 flex flex-col overflow-hidden transition-all duration-250 ease-out transform',
                    active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
                    maxWidth[size] || maxWidth.md,
                )}
            >
                <div className="ui-modal-header flex shrink-0 items-center justify-between gap-3 border-b-2 border-emerald-50">
                    {title ? <h2 className="ui-modal-title truncate font-black text-slate-900 uppercase tracking-tight">{title}</h2> : <span />}
                    {showClose ? <button type="button" onClick={onClose} aria-label="Close" className="ui-close-button inline-flex shrink-0 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black shadow-[0_4px_0_0_#9f1239] transition-transform active:scale-95">&times;</button> : null}
                </div>
                <div className="ui-modal-body min-h-0 flex-1 overflow-y-auto" data-ui-scrollable="true">
                    {children}
                </div>
                {footer ? <footer className="ui-modal-footer shrink-0 border-t-2 border-emerald-50">{footer}</footer> : null}
            </SurfacePanel>
        </div>
    );
}

export function SideSheet({ isOpen, onClose, title, side = 'left', children }) {
    const sidePosition = side === 'right' ? 'right-0' : 'left-0';
    const hiddenPosition = side === 'right' ? 'translate-x-full' : '-translate-x-full';

    return (
        <>
            <button
                type="button"
                aria-label="Close panel"
                onClick={onClose}
                className={cx(
                    'fixed inset-0 z-90 bg-emerald-950/40 backdrop-blur-xs transition-opacity',
                    isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
            />

            <aside
                data-ui-panel="true"
                className={cx(
                    'fixed top-0 z-95 h-dvh w-[min(28rem,92vw)] border-r border-emerald-100 bg-white transition-transform duration-300',
                    'shadow-[12px_0_0_0_rgba(5,46,22,0.05)]',
                    sidePosition,
                    isOpen ? 'translate-x-0' : hiddenPosition,
                )}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b-2 border-emerald-50 px-4 py-3 sm:px-6 sm:py-5">
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.12em] text-emerald-900">{title}</h3>
                        <button type="button" onClick={onClose} aria-label="Close panel" className="ui-close-button inline-flex items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black shadow-[0_4px_0_0_#9f1239] transition-transform active:scale-95">&times;</button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" data-ui-scrollable="true">
                        {children}
                    </div>
                </div>
            </aside>
        </>
    );
}
