export interface ContextPack {
    query: string;
    generatedAt: string;
    relevantNotes: Array<{
        relativePath: string;
        score: number;
        matchedTokens: string[];
        type?: string;
        title: string;
    }>;
    sourceCandidates: Array<{
        note: string;
        reason: string;
    }>;
    evidenceCandidates: Array<{
        note: string;
        blockId?: string;
        excerpt: string;
    }>;
    gaps: string[];
    staleWarnings: string[];
    suggestedWritebackTargets: string[];
    scanErrors: Array<{
        path: string;
        error: string;
    }>;
}
export interface ContextPackOptions {
    limit?: number;
    staleAfterDays?: number;
}
export declare function buildContextPack(vaultRoot: string, query: string, options?: ContextPackOptions): ContextPack;
