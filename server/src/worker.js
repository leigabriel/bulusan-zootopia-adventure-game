/* global WebSocketPair */
import { RoomHost } from '../../src/game/multiplayer/roomHost.js';
import {
    CLOSE, MAX_ROOMS, isValidRoomCode, makeRoomCode, normalizeRoomCode, privateRoomName, roomNameFor,
} from '../../src/game/multiplayer/protocol.js';

// Origins that may open a room. The Android app runs from https://localhost
// (Capacitor) and the website from bulusanzoo.com.
const DEFAULT_ORIGINS = [
    'https://bulusanzoo.com',
    'https://www.bulusanzoo.com',
    'https://localhost',
    'capacitor://localhost',
    'http://localhost:5173',
];

function originAllowed(request, env) {
    const origin = request.headers.get('Origin');
    if (!origin) return true; // native clients and tests send none
    const configured = (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (configured.length === 0) return true;
    return [...DEFAULT_ORIGINS, ...configured].includes(origin);
}

// Answers a WebSocket with a close code, so the game can read why (a plain
// HTTP error would only look like "could not connect").
function refuse(code, reason) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.close(code, reason);
    return new Response(null, { status: 101, webSocket: client });
}

// One Durable Object is one zoo room. It lives while someone is connected.
export class ZooRoom {
    constructor() {
        this.host = new RoomHost({ name: 'zoo' });
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/count') {
            return Response.json({ size: this.host.size, full: this.host.isFull, empty: this.host.isEmpty });
        }
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected a WebSocket', { status: 426 });
        }
        this.host.setName(request.headers.get('x-room') || 'zoo');

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();
        // Joining a private room that nobody is in: there is no such room.
        if (request.headers.get('x-mode') === 'join' && this.host.isEmpty) {
            server.close(CLOSE.NOT_FOUND, 'no such room');
            return new Response(null, { status: 101, webSocket: client });
        }
        const connId = this.host.open(server);
        server.addEventListener('message', (event) => {
            this.host.message(connId, typeof event.data === 'string' ? event.data : '');
        });
        const done = () => this.host.close(connId);
        server.addEventListener('close', done);
        server.addEventListener('error', done);
        return new Response(null, { status: 101, webSocket: client });
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/health') return new Response('ok');
        if (url.pathname !== '/join') return new Response('Not found', { status: 404 });
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
        if (!originAllowed(request, env)) return new Response('Origin not allowed', { status: 403 });

        const code = normalizeRoomCode(url.searchParams.get('code'));
        const create = url.searchParams.get('mode') === 'create';
        const roomStub = (name) => env.ZOO_ROOM.get(env.ZOO_ROOM.idFromName(name));
        const forward = (stub, name, mode) => {
            const headers = new Headers(request.headers);
            headers.set('x-room', name);
            headers.set('x-mode', mode);
            return stub.fetch(new Request(request, { headers }));
        };

        // Join a private room with its code.
        if (url.searchParams.has('code')) {
            if (!isValidRoomCode(code)) return refuse(CLOSE.NOT_FOUND, 'no such room');
            const name = privateRoomName(code);
            return forward(roomStub(name), name, 'join');
        }

        // Create a private room: find a code nobody is using right now.
        if (create) {
            for (let attempt = 0; attempt < 12; attempt += 1) {
                const name = privateRoomName(makeRoomCode());
                const stub = roomStub(name);
                const count = await (await stub.fetch('https://room/count')).json();
                if (count.empty) return forward(stub, name, 'create');
            }
            return new Response('Try again', { status: 503 });
        }

        // Public zoo: fill the oldest room that still has a seat.
        for (let index = 1; index <= MAX_ROOMS; index += 1) {
            const name = roomNameFor(index);
            const stub = roomStub(name);
            const count = await (await stub.fetch('https://room/count')).json();
            if (count.full) continue;
            return forward(stub, name, 'public');
        }
        return new Response('All rooms are full', { status: 503 });
    },
};
