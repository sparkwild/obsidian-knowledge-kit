import { ScannedNote } from './scan';
export interface GraphHealthOptions {
    maxItems?: number;
}
export interface GraphHealthReport {
    note_count: number;
    wikilink_edge_count: number;
    resolved_edge_count: number;
    unresolved_edge_count: number;
    largest_component_node_count: number;
    component_count: number;
    isolated_nodes: string[];
    isolated_node_count: number;
    only_inbound_nodes: string[];
    only_inbound_node_count: number;
    only_outbound_nodes: string[];
    only_outbound_node_count: number;
    hub_candidates: GraphHealthHubCandidate[];
    hub_candidate_count: number;
    missing_recommended_entry: string | null;
    missing_recommended_hubs: string[];
    missing_recommended_hub_count: number;
    recommendations: string[];
    recommendation_count: number;
}
export interface GraphHealthHubCandidate {
    path: string;
    degree: number;
    inbound: number;
    outbound: number;
}
export declare function analyzeGraphHealth(notes: ScannedNote[], options?: GraphHealthOptions): GraphHealthReport;
