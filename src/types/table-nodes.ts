export type ColumnType = "text" | "number" | "boolean";

export type Column = {
    name: string;
    type: ColumnType;
    description?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    references?: { table: string; column?: string };
};

export type TableNodeData = {
    schema?: string;
    table: string;
    description?: string;
    columns: Column[];
    data?: any[];
    reservedTableNames?: string[];
    otherTables?: Array<{ table: string; columns: Column[] }>;
    onEditColumns?: (nodeId: string, nextCols: Column[]) => void;
    onEditTableMeta?: (nodeId: string, next: { table: string; description?: string }) => void;
    onAfterImport?: (nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => void;
    onRefresh?: () => Promise<void> | void;
};