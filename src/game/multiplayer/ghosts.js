import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createGLTFLoader } from '../utils/gltfLoader.js';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { applyHumanSkinColor } from '../utils/characterMaterials.js';
import { createContactShadow } from '../utils/contactShadow.js';
import { EMOTES } from './protocol.js';
import { stepGhost } from './ghostMath.js';

const CHARACTER_HEIGHT = 1.5;
const EMOTE_SECONDS = 3;
const FILES = { boy: 'boy-character.gltf', girl: 'girl-character.gltf' };

function makeLabelSprite(draw, width, height, worldHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(worldHeight * (width / height), worldHeight, 1);
    sprite.renderOrder = 999;
    return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function makeNameTag(text) {
    return makeLabelSprite((ctx, w, h) => {
        ctx.font = '700 34px system-ui, sans-serif';
        const textW = Math.min(w - 24, ctx.measureText(text).width + 36);
        roundRect(ctx, (w - textW) / 2, 8, textW, h - 16, 22);
        ctx.fillStyle = 'rgba(16, 60, 40, 0.82)';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 2, w - 48);
    }, 384, 64, 0.34);
}

const EMOTE_ICONS = { heart: '❤️', star: '⭐', clap: '👏', wave: '👋', hello: '😊', thanks: '🌼' };

export function makeEmoteBubble(emoteId, language) {
    const emote = EMOTES.find((item) => item.id === emoteId);
    if (!emote) return null;
    const label = language === 'tl' ? emote.tl : emote.en;
    return makeLabelSprite((ctx, w, h) => {
        roundRect(ctx, 6, 6, w - 12, h - 12, 34);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#2f8f5b';
        ctx.stroke();
        ctx.fillStyle = '#1d2b22';
        ctx.textBaseline = 'middle';
        ctx.font = '48px system-ui, sans-serif';
        ctx.fillText(EMOTE_ICONS[emoteId] || '', 28, h / 2 + 3);
        ctx.font = '800 40px system-ui, sans-serif';
        ctx.fillText(label, 100, h / 2 + 3, w - 124);
    }, 300, 96, 0.62);
}

// Draws the other players in the scene: model, shadow, name tag and emote.
export class GhostPlayers {
    constructor(scene, { getLanguage = () => 'en' } = {}) {
        this.scene = scene;
        this.getLanguage = getLanguage;
        this.templates = new Map();
        this.pending = new Map();
        this.ghosts = new Map();
        this.muted = new Set();
        this.localEmote = null;
        this.disposed = false;
    }

    async loadTemplate(character) {
        if (this.templates.has(character)) return this.templates.get(character);
        if (this.pending.has(character)) return this.pending.get(character);
        const promise = (async () => {
            const url = await resolveAssetUrl(`/models/characters/${FILES[character] || FILES.boy}`);
            const gltf = await new Promise((resolve, reject) => createGLTFLoader().load(url, resolve, undefined, reject));
            const model = gltf.scene;
            applyHumanSkinColor(model);
            const box = new THREE.Box3().setFromObject(model);
            const height = Math.max(box.getSize(new THREE.Vector3()).y, 0.001);
            model.scale.multiplyScalar(THREE.MathUtils.clamp(CHARACTER_HEIGHT / height, 0.02, 5));
            const fitted = new THREE.Box3().setFromObject(model);
            const template = { model, animations: gltf.animations || [], baseY: -fitted.min.y };
            this.templates.set(character, template);
            return template;
        })();
        this.pending.set(character, promise);
        try { return await promise; } finally { this.pending.delete(character); }
    }

    add(player) {
        if (this.disposed || this.ghosts.has(player.id)) return;
        const ghost = {
            id: player.id,
            nick: player.nick,
            character: player.ch,
            root: new THREE.Group(),
            model: null,
            mixer: null,
            actions: {},
            current: null,
            baseY: 0,
            shadow: createContactShadow(1.7, 0.25),
            tag: makeNameTag(player.nick),
            bubble: null,
            bubbleUntil: 0,
            pos: { x: player.x ?? 0, y: player.y ?? 0, z: player.z ?? 0, yaw: player.yaw ?? 0 },
            target: { x: player.x ?? 0, y: player.y ?? 0, z: player.z ?? 0, yaw: player.yaw ?? 0 },
            action: 'idle',
        };
        ghost.root.visible = !this.muted.has(player.id);
        ghost.shadow.visible = ghost.root.visible;
        ghost.root.add(ghost.tag);
        ghost.tag.position.y = CHARACTER_HEIGHT + 0.75;
        this.scene.add(ghost.root);
        this.scene.add(ghost.shadow);
        this.ghosts.set(player.id, ghost);

        this.loadTemplate(ghost.character).then((template) => {
            if (this.disposed || this.ghosts.get(ghost.id) !== ghost) return;
            const model = cloneSkinned(template.model);
            ghost.model = model;
            ghost.baseY = template.baseY;
            ghost.root.add(model);
            model.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = false;
                child.receiveShadow = false;
            });
            if (template.animations.length > 0) {
                ghost.mixer = new THREE.AnimationMixer(model);
                template.animations.forEach((clip) => {
                    const action = ghost.mixer.clipAction(clip);
                    ghost.actions[clip.name.toLowerCase()] = action;
                });
                this.play(ghost, 'idle');
            }
        }).catch(() => { /* no model: the name tag and shadow still show */ });
    }

    play(ghost, name) {
        if (ghost.current === name) return;
        const find = (key) => ghost.actions[key]
            || Object.entries(ghost.actions).find(([clip]) => clip.includes(key))?.[1];
        const next = find(name) || find(name === 'run' ? 'walk' : 'idle');
        if (!next) return;
        const previous = ghost.currentAction;
        if (previous && previous !== next) previous.fadeOut(0.2);
        next.reset().fadeIn(0.2).play();
        ghost.currentAction = next;
        ghost.current = name;
    }

    remove(id) {
        const ghost = this.ghosts.get(id);
        if (!ghost) return;
        this.ghosts.delete(id);
        this.scene.remove(ghost.root);
        this.scene.remove(ghost.shadow);
        ghost.mixer?.stopAllAction();
        ghost.shadow.geometry.dispose();
        ghost.shadow.material.dispose();
        this.disposeSprite(ghost.tag);
        this.disposeSprite(ghost.bubble);
        // Geometry and materials of the clone are shared with the template, so
        // they are not disposed here.
    }

    disposeSprite(sprite) {
        if (!sprite) return;
        sprite.parent?.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
    }

    // Called with the list of players from snapshots.
    setTargets(players) {
        players.forEach((player) => {
            const ghost = this.ghosts.get(player.id);
            if (!ghost) return;
            ghost.target = { x: player.x, y: player.y, z: player.z, yaw: player.yaw };
            ghost.action = player.a || 'idle';
        });
    }

    showEmote(playerId, emoteId, nowSeconds) {
        const ghost = this.ghosts.get(playerId);
        if (!ghost) return;
        this.disposeSprite(ghost.bubble);
        ghost.bubble = makeEmoteBubble(emoteId, this.getLanguage());
        if (!ghost.bubble) return;
        ghost.bubble.position.y = CHARACTER_HEIGHT + 1.5;
        ghost.root.add(ghost.bubble);
        ghost.bubbleUntil = nowSeconds + EMOTE_SECONDS;
    }

    // Emote bubble above the local player's own character.
    showLocalEmote(emoteId, nowSeconds) {
        this.clearLocalEmote();
        const sprite = makeEmoteBubble(emoteId, this.getLanguage());
        if (!sprite) return;
        this.localEmote = { sprite, until: nowSeconds + EMOTE_SECONDS };
    }

    clearLocalEmote() {
        if (!this.localEmote) return;
        this.disposeSprite(this.localEmote.sprite);
        this.localEmote = null;
    }

    setMuted(id, muted) {
        if (muted) this.muted.add(id); else this.muted.delete(id);
        const ghost = this.ghosts.get(id);
        if (ghost) {
            ghost.root.visible = !muted;
            ghost.shadow.visible = !muted;
        }
    }

    isMuted(id) { return this.muted.has(id); }

    update(dt, nowSeconds, localPosition = null) {
        this.ghosts.forEach((ghost) => {
            const next = stepGhost(ghost.pos, ghost.target, dt);
            ghost.pos = next;
            ghost.root.position.set(next.x, next.y + ghost.baseY + 0.02, next.z);
            // The player model faces yaw + PI in third person; ghosts match.
            if (ghost.model) ghost.model.rotation.y = next.yaw + Math.PI;
            ghost.shadow.position.set(next.x, next.y + 0.055, next.z);
            const wantRun = ghost.action === 'run' || next.moving;
            this.play(ghost, wantRun ? 'run' : 'idle');
            ghost.mixer?.update(dt);
            if (ghost.bubble && nowSeconds > ghost.bubbleUntil) {
                this.disposeSprite(ghost.bubble);
                ghost.bubble = null;
            }
        });

        if (this.localEmote) {
            const { sprite, until } = this.localEmote;
            if (nowSeconds > until || !localPosition) {
                this.clearLocalEmote();
            } else {
                if (!sprite.parent) this.scene.add(sprite);
                sprite.position.set(localPosition.x, localPosition.y + CHARACTER_HEIGHT + 1.45, localPosition.z);
            }
        }
    }

    dispose() {
        this.disposed = true;
        [...this.ghosts.keys()].forEach((id) => this.remove(id));
        this.clearLocalEmote();
    }
}
