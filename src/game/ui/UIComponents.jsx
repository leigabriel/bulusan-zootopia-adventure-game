/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useId, useRef } from 'react';

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
        primary: 'sz-btn--primary',
        secondary: '',
        danger: 'sz-btn--danger',
        warning: 'sz-btn--sun',
        ghost: 'sz-btn--ghost',
    };

    const sizeClasses = { sm: 'sz-btn--sm', md: '', lg: 'sz-btn--lg' };

    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'sz-btn uppercase',
                variantClasses[variant] ?? variantClasses.primary,
                sizeClasses[size] ?? '',
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
                'sz-icon-btn sz-icon-btn--round',
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
        slate: '',
        dark: 'sz-btn--ghost',
        emerald: 'sz-btn--primary',
        rose: 'sz-btn--danger',
        amber: 'sz-btn--sun',
        sky: 'sz-btn--sky',
    };

    const sizeClasses = { sm: 'sz-btn--sm', md: '', lg: 'sz-btn--lg' };

    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx('sz-btn uppercase', colorClasses[color] ?? '', sizeClasses[size] ?? '', className)}
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
                'ui-surface sz-card',
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
            <span className="sz-chip sz-chip--sun min-w-16 justify-center" aria-live="polite">
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
    const titleId = useId();
    const panelRef = useRef(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    // Escape closes the dialog, focus moves inside it and returns afterwards.
    useEffect(() => {
        if (!isOpen) return undefined;
        const previouslyFocused = document.activeElement;
        const focusTimer = setTimeout(() => {
            const panel = panelRef.current;
            if (!panel) return;
            const target = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            (target || panel).focus?.();
        }, 0);
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            onCloseRef.current?.();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener('keydown', onKeyDown, true);
            if (previouslyFocused && previouslyFocused.focus && document.contains(previouslyFocused)) previouslyFocused.focus();
        };
    }, [isOpen]);

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
            aria-labelledby={title ? titleId : undefined}
        >
            <button
                type="button"
                aria-label="Close modal"
                onClick={closeOnBackdrop ? onClose : undefined}
                className={cx(
                    'absolute inset-0 bg-[#3b2a1a]/45 backdrop-blur-xs transition-opacity duration-250 ease-out',
                    active ? 'opacity-100' : 'opacity-0'
                )}
            />

            <SurfacePanel
                ref={panelRef}
                tabIndex={-1}
                className={cx(
                    'ui-modal relative z-121 flex flex-col overflow-hidden transition-all duration-250 ease-out transform',
                    active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
                    maxWidth[size] || maxWidth.md,
                )}
            >
                <div className="ui-modal-header sz-card-header shrink-0">
                    {title ? <h2 id={titleId} className="ui-modal-title sz-title truncate uppercase">{title}</h2> : <span />}
                    {showClose ? <button type="button" data-ui-button="true" onClick={onClose} aria-label="Close" className="sz-icon-btn sz-icon-btn--round sz-icon-btn--close shrink-0">&times;</button> : null}
                </div>
                <div className="ui-modal-body min-h-0 flex-1 overflow-y-auto" data-ui-scrollable="true">
                    {children}
                </div>
                {footer ? <footer className="ui-modal-footer shrink-0 border-t-[3px] border-(--sz-line)">{footer}</footer> : null}
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
                    'fixed inset-0 z-90 bg-[#3b2a1a]/45 backdrop-blur-xs transition-opacity',
                    isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
            />

            <aside
                data-ui-panel="true"
                className={cx(
                    'sz-card fixed top-0 z-95 h-dvh w-[min(28rem,92vw)] rounded-none transition-transform duration-300',
                    sidePosition,
                    isOpen ? 'translate-x-0' : hiddenPosition,
                )}
            >
                <div className="flex h-full flex-col">
                    <div className="sz-card-header">
                        <h3 className="sz-title uppercase">{title}</h3>
                        <button type="button" data-ui-button="true" onClick={onClose} aria-label="Close panel" className="sz-icon-btn sz-icon-btn--round sz-icon-btn--close">&times;</button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" data-ui-scrollable="true">
                        {children}
                    </div>
                </div>
            </aside>
        </>
    );
}
