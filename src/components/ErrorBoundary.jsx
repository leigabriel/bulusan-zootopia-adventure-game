import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Game error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-950 p-6 text-center">
                    <div className="max-w-md rounded-2xl border-2 border-emerald-700 bg-emerald-900 p-8 shadow-2xl">
                        <h1 className="mb-3 text-2xl font-black uppercase text-amber-400">
                            Oops!
                        </h1>
                        <p className="mb-4 text-sm font-semibold leading-relaxed text-emerald-100">
                            The game ran into a problem. This usually happens when your device does not support WebGL or runs out of memory.
                        </p>
                        <p className="mb-6 rounded-xl bg-emerald-950/60 p-3 text-xs font-mono text-emerald-300">
                            {this.state.error?.message || 'Unknown error'}
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="min-h-12 rounded-xl bg-emerald-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-[0_4px_0_0_#065f46] transition-all active:translate-y-1 active:shadow-none"
                        >
                            Reload Game
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
