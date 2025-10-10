/**
 * Core type definitions for the Flow application
 */

// Column types for TableNode
export type ColumnType = "text" | "number" | "boolean";

export type Column = {
  name: string;
  type: ColumnType;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: { table: string; column?: string };
};

// Table Node data structure
export type TableNodeData = {
  schema?: string;
  table: string;
  description?: string;
  columns: Column[];
  data?: any[]; // Actual data rows for the table
  reservedTableNames?: string[];
  otherTables?: Array<{ table: string; columns: Column[] }>; // Other tables for FK references
  onEditColumns?: (nodeId: string, nextCols: Column[]) => void;
  onEditTableMeta?: (nodeId: string, next: { table: string; description?: string }) => void;
  onAfterImport?: (nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => void;
  onRefresh?: () => Promise<void> | void;
};

// Catalog type
export type Catalog = {
  tables: Array<{ name: string; pkColumns: string[] }>;
};

// Chat message types
export type ChatMessage =
  | { id: string; role: "user"; text: string; createdAt: number }
  | { id: string; role: "assistant"; text?: string; createdAt: number; data?: any }
  | { id: string; role: "error"; text: string; createdAt: number };

// Version history
export type HistoryItem = {
  version: number;
  created_at: string;
  restored_from: number | null;
};

