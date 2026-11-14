// Keeps CHANGELOG.md up to date.
//   node scripts/changelog.mjs release <versionName> <versionCode>
// Reads the commit subjects since the previous "chore: release" commit, groups
// them (Added, Fixed, Changed, Removed), adds a section for the new version and
// updates the "Current version" block. The Android workflow runs it right before
// it commits the version bump. Entries live between the markers in CHANGELOG.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogFile = join(root, 'CHANGELOG.md');

export const CURRENT_START = '<!-- changelog:current -->';
export const CURRENT_END = '<!-- /changelog:current -->';
export const ENTRIES_MARKER = '<!-- changelog:entries -->';

const SECTION_BY_TYPE = {
    feat: 'Added',
    fix: 'Fixed',
    remove: 'Removed',
    update: 'Changed',
    refactor: 'Changed',
    style: 'Changed',
    perf: 'Changed',
    docs: 'Changed',
    build: 'Changed',
    ci: 'Changed',
};
const SECTION_ORDER = ['Added', 'Changed', 'Fixed', 'Removed'];
// Housekeeping commits that mean nothing to a player.
const SKIPPED_TYPES = new Set(['chore', 'test']);

export function parseSubject(subject) {
    const match = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/.exec(String(subject).trim());
    if (!match) return null;
    const [, type, scope, text] = match;
    if (/^merge$/i.test(type) || SKIPPED_TYPES.has(type.toLowerCase())) return null;
    const section = SECTION_BY_TYPE[type.toLowerCase()];
    if (!section) return null;
    const sentence = text.charAt(0).toUpperCase() + text.slice(1);
    return { section, text: scope ? `${scope}: ${sentence}` : sentence };
}

export function groupSubjects(subjects) {
    const groups = new Map(SECTION_ORDER.map((name) => [name, []]));
    const seen = new Set();
    for (const subject of subjects) {
        const entry = parseSubject(subject);
        if (!entry || seen.has(entry.text)) continue;
        seen.add(entry.text);
        groups.get(entry.section).push(entry.text);
    }
    return groups;
}

export function renderEntry({ versionName, versionCode, date, subjects }) {
    const groups = groupSubjects(subjects);
    const lines = [`## ${versionName} (${date})`, '', `Version code ${versionCode}.`, ''];
    let any = false;
    for (const name of SECTION_ORDER) {
        const items = groups.get(name);
        if (!items.length) continue;
        any = true;
        lines.push(`### ${name}`, ...items.map((item) => `- ${item}`), '');
    }
    if (!any) lines.push('- Maintenance and internal changes.', '');
    return lines.join('\n').trimEnd();
}

export function currentBlock(versionName, versionCode, date) {
    return `${CURRENT_START}\n**Current version: ${versionName}** (version code ${versionCode}, released ${date})\n${CURRENT_END}`;
}

export function applyRelease(markdown, { versionName, versionCode, date, subjects }) {
    if (!markdown.includes(ENTRIES_MARKER) || !markdown.includes(CURRENT_START) || !markdown.includes(CURRENT_END)) {
        throw new Error('CHANGELOG.md is missing its changelog markers');
    }
    // Running twice for the same version must not duplicate the section.
    if (new RegExp(`^## ${versionName.replace('.', '\\.')} \\(`, 'm').test(markdown)) return markdown;
    const entry = renderEntry({ versionName, versionCode, date, subjects });
    const start = markdown.indexOf(CURRENT_START);
    const end = markdown.indexOf(CURRENT_END) + CURRENT_END.length;
    const withCurrent = markdown.slice(0, start) + currentBlock(versionName, versionCode, date) + markdown.slice(end);
    return withCurrent.replace(ENTRIES_MARKER, `${ENTRIES_MARKER}\n\n${entry}`);
}

function commitSubjectsSinceLastRelease() {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const lastRelease = git('log', '--grep=^chore: release', '-n', '1', '--format=%H');
    const range = lastRelease ? `${lastRelease}..HEAD` : 'HEAD';
    const out = git('log', range, '--no-merges', '--reverse', '--format=%s');
    return out ? out.split('\n') : [];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const [command, versionName, versionCode] = process.argv.slice(2);
    if (command !== 'release' || !/^\d+\.\d+$/.test(versionName || '') || !/^\d+$/.test(versionCode || '')) {
        console.error('usage: node scripts/changelog.mjs release <versionName> <versionCode>');
        process.exit(1);
    }
    const date = new Date().toISOString().slice(0, 10);
    const next = applyRelease(readFileSync(changelogFile, 'utf8'), {
        versionName, versionCode: Number(versionCode), date, subjects: commitSubjectsSinceLastRelease(),
    });
    writeFileSync(changelogFile, next);
    console.log(`CHANGELOG.md updated for ${versionName}`);
}
