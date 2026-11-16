// Saves a captured photo (PNG data URL) to the player's device, only when the
// player presses Save in the photo preview.
// Android app: native bridge writes into Pictures/Bulusan Zootopia.
// Browsers: the PNG is downloaded.

let photoCounter = 0;

// Every call gives a new name: date, time to the millisecond and a counter, so
// two photos taken in the same second never overwrite each other.
export function photoFileName(date = new Date()) {
    const stamp = date.toISOString().replace(/[:.]/g, '-').replace('Z', '');
    photoCounter = (photoCounter + 1) % 1000;
    return `bulusan-zoo-adventure-${stamp}-${String(photoCounter).padStart(3, '0')}.png`;
}

export function dataUrlToBase64(dataUrl) {
    const index = String(dataUrl || '').indexOf(',');
    return index === -1 ? '' : dataUrl.slice(index + 1);
}

function dataUrlToBlob(dataUrl) {
    const base64 = dataUrlToBase64(dataUrl);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
}

// Resolves to { ok, method, message }.
export async function savePhotoToDevice(dataUrl, win = typeof window !== 'undefined' ? window : null) {
    const fileName = photoFileName();
    if (!win || !dataUrl) return { ok: false, method: 'none', message: 'No photo to save.' };

    const native = win.AndroidPhotoSaver;
    if (native && typeof native.savePng === 'function') {
        try {
            const saved = native.savePng(fileName, dataUrlToBase64(dataUrl));
            return saved
                ? { ok: true, method: 'android', message: 'Photo saved to your gallery.' }
                : { ok: false, method: 'android', message: 'Allow storage permission, then tap Save again.' };
        } catch {
            return { ok: false, method: 'android', message: 'Could not save the photo.' };
        }
    }

    try {
        const blob = dataUrlToBlob(dataUrl);
        const url = win.URL.createObjectURL(blob);
        const link = win.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.rel = 'noopener';
        win.document.body.appendChild(link);
        link.click();
        link.remove();
        win.setTimeout(() => win.URL.revokeObjectURL(url), 10000);
        return { ok: true, method: 'download', message: 'Photo saved to your downloads.' };
    } catch {
        return { ok: false, method: 'download', message: 'Could not save the photo.' };
    }
}
