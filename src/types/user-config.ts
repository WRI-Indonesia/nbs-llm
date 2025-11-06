export interface UserConfig {
    chunkSize: number;
    overlap: number;
    topK: number;
    minCos: number;
    cacheEnabled: boolean;
    semanticTopK: number;
    cacheTtlSemretr: number;
    useHybridSearch: boolean;
    hybridMinCosine: number;
    hybridTopK: number;
    hybridAlpha: number;
    rerankEnabled: boolean;
    rerankTopN: number;
    rerankModelName: string;
    repromptAgentModel: string;
    sqlGeneratorAgentModel: string;
    embeddingAgentModel: string;
    summarizationModelEndpoint: string;
    summarizationModel: string;
}
