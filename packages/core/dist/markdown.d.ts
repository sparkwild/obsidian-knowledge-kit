export interface ParsedFrontmatter {
    fields: Record<string, unknown>;
    raw: string;
    body: string;
}
export interface Wikilink {
    raw: string;
    target: string;
    alias?: string;
    heading?: string;
    line: number;
}
export interface CalloutBlock {
    type: string;
    rawHeader: string;
    content: string;
    sourceRefs: string[];
    blockId?: string;
    line: number;
    endLine: number;
}
export interface ParsedMarkdown {
    frontmatter: ParsedFrontmatter;
    title: string;
    body: string;
    tags: string[];
    headings: string[];
    blockIds: string[];
    wikilinks: Wikilink[];
    claimBlocks: CalloutBlock[];
    evidenceBlocks: CalloutBlock[];
    searchText: string;
}
export declare function parseFrontmatter(rawContent: string): ParsedFrontmatter;
export declare function extractWikilinks(content: string): Wikilink[];
export declare function extractHeadings(content: string): string[];
export declare function extractTags(frontmatter: Record<string, unknown>, content: string): string[];
export declare function extractBlockIds(content: string): string[];
export declare function parseMarkdown(rawContent: string): ParsedMarkdown;
