declare module 'pdf-parse' {
  export interface PDFData {
    numpages: number
    numrender: number
    info: any
    metadata: any | null
    text: string
    version: string
  }

  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>
  export default pdfParse
}

