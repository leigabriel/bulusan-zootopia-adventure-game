import { useSyncExternalStore } from 'react';

function subscribe(callback) {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
    };
}

// True when the device says it has a connection (wifi or mobile data). Some
// networks are connected but have no internet, so the room server may still be
// unreachable; the game handles that with its own message.
export function isOnlineNow() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function useOnlineStatus() {
    return useSyncExternalStore(subscribe, isOnlineNow, () => true);
}
