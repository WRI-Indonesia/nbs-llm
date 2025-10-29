

// /**
//  * Maps RAG documents to the standardized format
//  */
// export function mapRelevantDocuments(relevantDocs: any[]): RelevantDocument[] {
//   return relevantDocs.map(item => ({
//     id: item.doc.id,
//     tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
//     text: item.doc.text,
//     similarity: item.similarity,
//     documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
//   }))
// }

// /**
//  * Creates search stats object
//  */
// export function createSearchStats(
//   totalDocumentsFound: number,
//   minCosineThreshold: number,
//   topK: number
// ): SearchStats {
//   return {
//     totalDocumentsFound,
//     minCosineThreshold,
//     topK
//   }
// }
