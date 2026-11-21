import { MultiplayerClient, STATUS } from './client.js';
import { GhostPlayers } from './ghosts.js';
import { chatProblem, normalizeChat, roomCodeFromName } from './protocol.js';

const MAX_MESSAGES = 40;
const NOTICE_MS = 4000;

// Joins the game scene and the room server. The game calls `tick` every frame;
// the menu and HUD listen through `onChange`.
export class TogetherSession {
    constructor({ scene, url, nick, character, mode = 'public', code = '', getLanguage, onChange = () => {}, WebSocketImpl }) {
        this.onChange = onChange;
        this.reported = new Set();
        this.ghosts = new GhostPlayers(scene, { getLanguage });
        this.client = new MultiplayerClient({ url, nick, character, mode, code, WebSocketImpl });
        this.messages = [];
        this.messageCount = 0;
        this.notice = '';
        this.noticeTimer = null;

        this.client.onStatus = () => this.notify();
        this.client.onJoin = (player, all) => {
            (all || [player]).forEach((p) => this.ghosts.add(p));
            this.notify();
        };
        this.client.onLeave = (id) => {
            this.ghosts.remove(id);
            this.notify();
        };
        this.client.onSnap = (list) => this.ghosts.setTargets(list);
        this.client.onChat = (id, text) => {
            const mine = id === this.client.selfId;
            const nickName = mine ? this.client.nick : this.client.players.get(id)?.nick;
            if (!nickName) return;
            this.messageCount += 1;
            this.messages.push({ key: this.messageCount, id, nick: nickName, text, mine });
            if (this.messages.length > MAX_MESSAGES) this.messages.shift();
            this.notify();
        };
        this.client.onChatRefused = (reason) => this.setNotice(reason);
        this.client.onEmote = (id, emoteId) => {
            if (id === this.client.selfId) return;
            if (this.ghosts.isMuted(id)) return;
            this.ghosts.showEmote(id, emoteId, performance.now() / 1000);
        };
    }

    start() { this.client.connect(); }

    get status() { return this.client.status; }

    snapshot() {
        return {
            status: this.client.status,
            room: this.client.room,
            code: roomCodeFromName(this.client.room),
            nick: this.client.nick,
            notice: this.notice,
            messages: this.messages.filter((message) => message.mine || !this.ghosts.isMuted(message.id)),
            players: [...this.client.players.values()].map((p) => ({
                id: p.id,
                nick: p.nick,
                character: p.ch,
                muted: this.ghosts.isMuted(p.id),
                reported: this.reported.has(p.id),
            })),
        };
    }

    notify() { this.onChange(this.snapshot()); }

    // feet = { x, y, z } of the local player's feet, yaw as the game uses it.
    tick(nowMs, dt, feet, yaw, action) {
        this.client.update(nowMs, { x: feet.x, y: feet.y, z: feet.z, yaw, a: action });
        this.ghosts.update(dt, nowMs / 1000, feet);
    }

    sendEmote(id) {
        if (!this.client.isOnline) return false;
        if (!this.client.sendEmote(id)) return false;
        this.ghosts.showLocalEmote(id, performance.now() / 1000);
        return true;
    }

    toggleMute(id) {
        this.ghosts.setMuted(id, !this.ghosts.isMuted(id));
        this.notify();
    }

    setNotice(reason) {
        this.notice = reason;
        clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => { this.notice = ''; this.notify(); }, NOTICE_MS);
        this.notify();
    }

    // Returns true when the message was sent. The room checks it again.
    sendChat(raw) {
        if (!this.client.isOnline) return false;
        const text = normalizeChat(raw);
        const problem = chatProblem(text);
        if (problem) {
            if (problem !== 'empty') this.setNotice(problem);
            return false;
        }
        return this.client.sendChat(text);
    }

    // A report also hides that player for this child straight away.
    report(id) {
        if (this.reported.has(id)) return;
        this.reported.add(id);
        this.client.report(id);
        this.ghosts.setMuted(id, true);
        this.notify();
    }

    stop() {
        clearTimeout(this.noticeTimer);
        this.client.onStatus = () => {};
        this.client.close();
        this.ghosts.dispose();
    }
}

export { STATUS };
