// Importamos o arquivo interno (pdf-parse/lib/pdf-parse.js) em vez do index pra
// evitar o "debug mode" do pacote, que tenta ler um PDF de teste no import e
// quebra sob ESM. Este shim de tipos cobre essa importacao.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
  }
  function pdf(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdf;
}
