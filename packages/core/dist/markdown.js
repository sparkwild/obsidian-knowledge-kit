"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFrontmatter = parseFrontmatter;
exports.extractWikilinks = extractWikilinks;
exports.extractHeadings = extractHeadings;
exports.extractTags = extractTags;
exports.extractBlockIds = extractBlockIds;
exports.parseMarkdown = parseMarkdown;
const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const YAML_LIST_PATTERN = /^\[(.*)\]$/;
const CALLER_BLOCK_ID = /^\s*\^([A-Za-z0-9._-]+)\s*$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)\s*$/;
const EXTERNAL_LINK = /^(?:https?:\/\/|mailto:|file:|ftp:)/i;
function parseFrontmatter(rawContent) {
    const normalized = rawContent.replace(/\r\n/g, '\n');
    const match = normalized.match(FRONT_MATTER_PATTERN);
    if (!match) {
        return {
            fields: {},
            raw: '',
            body: normalized,
        };
    }
    const frontmatterRaw = match[1] ?? '';
    const body = normalized.slice((match[0] ?? '').length);
    return {
        fields: parseFrontmatterBody(frontmatterRaw),
        raw: frontmatterRaw,
        body,
    };
}
function parseFrontmatterBody(frontmatterRaw) {
    const fields = {};
    const lines = frontmatterRaw.split('\n').map((line) => line.trim());
    for (const line of lines) {
        if (!line || line.startsWith('#')) {
            continue;
        }
        const delimiterIndex = line.indexOf(':');
        if (delimiterIndex <= 0) {
            continue;
        }
        const key = line.slice(0, delimiterIndex).trim();
        const value = line.slice(delimiterIndex + 1).trim();
        fields[key] = parseFrontmatterValue(value);
    }
    return fields;
}
function parseFrontmatterValue(value) {
    if (!value) {
        return '';
    }
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    if (value === 'null') {
        return null;
    }
    if (!Number.isNaN(Number(value)) && Number.isFinite(Number(value))) {
        return Number(value);
    }
    const listMatch = value.match(YAML_LIST_PATTERN);
    if (listMatch) {
        return listMatch[1]
            .split(',')
            .map((item) => parseFrontmatterValue(item.trim().replace(/^['"]|['"]$/g, '')))
            .filter((item) => item !== '');
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
function extractWikilinks(content) {
    const lines = content.split('\n');
    const wikilinks = [];
    const wikilinkPattern = /\[\[([^\]]+)\]\]/g;
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        const line = lines[lineNumber];
        let match;
        while ((match = wikilinkPattern.exec(line)) !== null) {
            const raw = match[1].trim();
            if (!raw || EXTERNAL_LINK.test(raw)) {
                continue;
            }
            const [targetPart, alias] = raw.split('|', 2);
            const [targetBase, heading] = targetPart.split('#', 2);
            if (!targetBase) {
                continue;
            }
            wikilinks.push({
                raw: match[0],
                target: targetBase.trim(),
                alias: alias?.trim(),
                heading: heading?.trim(),
                line: lineNumber + 1,
            });
        }
    }
    return wikilinks;
}
function extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(HEADING_PATTERN);
        if (match) {
            headings.push(match[2].trim());
        }
    }
    return headings;
}
function extractTags(frontmatter, content) {
    const tags = new Set();
    const fmTags = frontmatter.tags;
    if (typeof fmTags === 'string') {
        for (const tag of fmTags.split(',').map((tag) => tag.trim())) {
            if (tag) {
                tags.add(tag);
            }
        }
    }
    else if (Array.isArray(fmTags)) {
        for (const item of fmTags) {
            if (typeof item === 'string' && item.trim()) {
                tags.add(item.trim());
            }
        }
    }
    const hashTags = content.match(/#[A-Za-z0-9/_-]+/g);
    if (hashTags) {
        for (const tag of hashTags) {
            tags.add(tag.slice(1));
        }
    }
    return [...tags];
}
function parseSourceRefsFromCallout(lines) {
    const refs = new Set();
    for (const line of lines) {
        const match = line.match(/source::\s*(.*)/i);
        if (!match) {
            continue;
        }
        const trailing = match[1] ?? '';
        for (const link of extractWikilinks(trailing)) {
            refs.add(link.target);
        }
    }
    return [...refs];
}
function extractCalloutBlocks(content, kind) {
    const rawLines = content.split('\n');
    const results = [];
    const startPattern = new RegExp(`^>\\s*\\[!${kind}\\]\\b`, 'i');
    let lineIndex = 0;
    while (lineIndex < rawLines.length) {
        const line = rawLines[lineIndex];
        const trimmed = line.trim();
        if (!startPattern.test(trimmed)) {
            lineIndex += 1;
            continue;
        }
        const startLine = lineIndex + 1;
        const blockLines = [line];
        lineIndex += 1;
        while (lineIndex < rawLines.length) {
            const current = rawLines[lineIndex];
            if (current.trim() === '' && blockLines.length > 0) {
                blockLines.push(current);
                lineIndex += 1;
                continue;
            }
            if (!current.trim().startsWith('>')) {
                break;
            }
            blockLines.push(current);
            lineIndex += 1;
        }
        let blockId;
        if (lineIndex < rawLines.length && rawLines[lineIndex].match(CALLER_BLOCK_ID)) {
            blockId = rawLines[lineIndex].match(CALLER_BLOCK_ID)?.[1];
            lineIndex += 1;
        }
        const sourceRefs = parseSourceRefsFromCallout(blockLines);
        const contentText = blockLines
            .map((entry) => entry.replace(/^\s*>\s?/, ''))
            .join('\n')
            .trim();
        results.push({
            type: kind,
            rawHeader: blockLines[0]?.trim() ?? '',
            content: contentText,
            sourceRefs,
            blockId,
            line: startLine,
            endLine: lineIndex,
        });
    }
    return results;
}
function extractBlockIds(content) {
    const ids = new Set();
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(CALLER_BLOCK_ID);
        if (match) {
            ids.add(match[1]);
        }
    }
    return [...ids];
}
function parseMarkdown(rawContent) {
    const normalized = rawContent.replace(/\r\n/g, '\n');
    const frontmatter = parseFrontmatter(normalized);
    const frontmatterTitle = typeof frontmatter.fields.title === 'string' ? frontmatter.fields.title : '';
    const tags = extractTags(frontmatter.fields, frontmatter.body);
    const headings = extractHeadings(frontmatter.body);
    const wikilinks = extractWikilinks(frontmatter.body);
    const blockIds = extractBlockIds(frontmatter.body);
    const claimBlocks = extractCalloutBlocks(frontmatter.body, 'claim');
    const evidenceBlocks = extractCalloutBlocks(frontmatter.body, 'evidence');
    const searchText = [frontmatterTitle, ...tags, ...headings, frontmatter.body].join('\n');
    return {
        frontmatter,
        title: frontmatterTitle,
        body: frontmatter.body,
        tags,
        headings,
        blockIds,
        wikilinks,
        claimBlocks,
        evidenceBlocks,
        searchText,
    };
}
