export const safeId = (table: string, col: string, suffix: "in" | "out") =>
    `${table}__${col.replace(/\s+/g, "_").toLowerCase()}__${suffix}`

