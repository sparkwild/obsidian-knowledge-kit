import { McpToolDefinition, McpStructuredToolResult, McpPrompt } from './protocol';
interface ToolContext {
    defaultVaultRoot?: string;
}
export declare function toolDefinitions(): McpToolDefinition[];
export declare function toolPrompts(): McpPrompt[];
export declare function callTool(name: string, rawParams: unknown, context: ToolContext): McpStructuredToolResult;
export {};
