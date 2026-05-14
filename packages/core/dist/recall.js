"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreNote = scoreNote;
exports.recallNotes = recallNotes;
const MIN_TOKEN_LENGTH = 2;
const DEFAULT_LIMIT = 6;
function tokenize(input) {
    const text = input.toLowerCase().normalize('NFKC');
    return [...new Set((text.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? []))]
        .filter((token) => token.length >= MIN_TOKEN_LENGTH);
}
function frontmatterString(note, key) {
    const value = note.frontmatter[key];
    return typeof value === 'string' ? value : '';
}
function weightedTokensFromNote(note) {
    const tokens = new Set([
        ...tokenize(note.title),
        ...tokenize(frontmatterString(note, 'title')),
        ...note.tags.flatMap((tag) => tokenize(tag)),
        ...note.aliases.flatMap((alias) => tokenize(alias)),
        ...note.headings.flatMap((heading) => tokenize(heading)),
        ...tokenize(note.tokens),
    ]);
    const weighted = {};
    for (const token of tokens) {
        let weight = 1;
        if (tokenize(note.title).includes(token)) {
            weight += 3;
        }
        if (note.tags.some((tag) => tokenize(tag).includes(token))) {
            weight += 2;
        }
        if (note.aliases.some((alias) => tokenize(alias).includes(token))) {
            weight += 2;
        }
        weighted[token] = weight;
    }
    return weighted;
}
function scoreNote(note, queryTokens) {
    if (queryTokens.length === 0) {
        return 0;
    }
    const weights = weightedTokensFromNote(note);
    let score = 0;
    for (const token of queryTokens) {
        if (weights[token]) {
            score += weights[token];
        }
    }
    return score;
}
function recallNotes(notes, query, options = {}) {
    const tokens = tokenize(query);
    const limit = options.limit ?? DEFAULT_LIMIT;
    const matches = [];
    for (const note of notes) {
        const score = scoreNote(note, tokens);
        if (score <= 0) {
            continue;
        }
        const matchedTokens = tokens.filter((token) => weightForNoteToken(note, token) > 0);
        matches.push({
            note,
            score,
            matchedTokens,
        });
    }
    return matches.sort((a, b) => b.score - a.score || a.note.relativePath.localeCompare(b.note.relativePath)).slice(0, limit);
}
function weightForNoteToken(note, token) {
    if (tokenize(note.title).includes(token)) {
        return 4;
    }
    if (tokenize(frontmatterString(note, 'type')).includes(token)) {
        return 3;
    }
    if (note.tags.some((tag) => tokenize(tag).includes(token))) {
        return 2;
    }
    if (note.aliases.some((alias) => tokenize(alias).includes(token))) {
        return 2;
    }
    return 0;
}
