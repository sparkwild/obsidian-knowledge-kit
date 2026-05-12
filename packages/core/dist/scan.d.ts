import { parseMarkdown } from './markdown';
export interface ScannedNote {
    absolutePath: string;
    relativePath: string;
    title: string;
    size: number;
    modifiedAt: string;
    tokens: string;
    frontmatter: Record<string, unknown>;
    aliases: string[];
    type?: string;
    tags: string[];
    headings: string[];
    blockIds: string[];
    wikilinks: ReturnType<typeof parseMarkdown>['wikilinks'];
    claimBlocks: ReturnType<typeof parseMarkdown>['claimBlocks'];
    evidenceBlocks: ReturnType<typeof parseMarkdown>['evidenceBlocks'];
    content: string;
}
export interface ScanError {
    path: string;
    error: string;
}
export interface ScanResult {
    vaultRoot: string;
    scannedAt: string;
    notes: ScannedNote[];
    errors: ScanError[];
}
export declare function scanVault(vaultRoot: string): ScanResult;
