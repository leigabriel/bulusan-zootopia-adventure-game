import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import MiniZooGame from './game/MiniZooGame.jsx';
import { installClickSparkles } from './game/utils/clickSparkles.js';

function App() {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setShowSplash(false), 2200);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => installClickSparkles(), []);

    if (showSplash) {
        return (
            <div className="app-splash" style={{ background: '#fff' }} role="status" aria-label="Opening Bulusan Zootopia Adventure">
                <img
                    className="app-splash-icon"
                    src="/bulusanzoo-icon.png"
                    alt="Bulusan Zootopia Adventure"
                />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <MiniZooGame />
        </ErrorBoundary>
    );
}

export default App;
