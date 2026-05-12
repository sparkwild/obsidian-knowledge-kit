import { ScannedNote } from './scan';
export interface LintIssue {
    severity: 'error' | 'warning';
    kind: 'broken_wikilink' | 'claim_missing_source';
    path: string;
    line: number;
    message: string;
    context?: string;
}
export interface LintReport {
    issues: LintIssue[];
}
export declare function lintNotes(vaultRoot: string, notes: ScannedNote[]): LintReport;
