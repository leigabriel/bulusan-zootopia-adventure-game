// Local room server for testing without Cloudflare. Same rules, same RoomHost.
//   npm run mp:dev        (from the project folder)
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { RoomHost } from '../src/game/multiplayer/roomHost.js';
import {
    CLOSE, MAX_ROOMS, isValidRoomCode, makeRoomCode, normalizeRoomCode, privateRoomName, roomNameFor,
} from '../src/game/multiplayer/protocol.js';

export function startDevServer({ port = Number(process.env.PORT) || 8787, log = console.log } = {}) {
    const rooms = new Map();
    const getRoom = (name) => {
        if (!rooms.has(name)) rooms.set(name, new RoomHost({ name, log }));
        return rooms.get(name);
    };

    const server = http.createServer((request, response) => {
        if (request.url === '/health') {
            response.end('ok');
            return;
        }
        response.statusCode = 404;
        response.end('Not found');
    });

    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, 'http://x');
        if (url.pathname !== '/join') {
            socket.destroy();
            return;
        }
        let room = null;
        let refused = null;
        if (url.searchParams.has('code')) {
            const code = normalizeRoomCode(url.searchParams.get('code'));
            const existing = isValidRoomCode(code) ? rooms.get(privateRoomName(code)) : null;
            if (existing && !existing.isEmpty) room = existing;
            else refused = CLOSE.NOT_FOUND;
        } else if (url.searchParams.get('mode') === 'create') {
            for (let attempt = 0; attempt < 12 && !room; attempt += 1) {
                const candidate = getRoom(privateRoomName(makeRoomCode()));
                if (candidate.isEmpty) room = candidate;
            }
        } else {
            for (let index = 1; index <= MAX_ROOMS; index += 1) {
                const candidate = getRoom(roomNameFor(index));
                if (!candidate.isFull) { room = candidate; break; }
            }
        }
        if (!room && refused === null) {
            socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
            socket.destroy();
            return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
            if (!room) {
                ws.close(refused, 'no such room');
                return;
            }
            const connId = room.open(ws);
            ws.on('message', (data) => room.message(connId, data.toString()));
            ws.on('close', () => room.close(connId));
            ws.on('error', () => room.close(connId));
        });
    });

    return new Promise((resolve) => {
        server.listen(port, () => {
            log(`Room server on ws://localhost:${server.address().port}/join`);
            resolve({
                port: server.address().port,
                rooms,
                close: () => new Promise((done) => {
                    rooms.forEach((room) => room.stop());
                    wss.clients.forEach((client) => client.terminate());
                    server.close(done);
                }),
            });
        });
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    startDevServer();
}
