/**
 * Divide a resposta da IA em "chunks" no estilo WhatsApp:
 * múltiplas mensagens curtas em sequência, em vez de um bloco gigante.
 *
 * Estratégia:
 *  1. quebra por parágrafos (`\n\n`)
 *  2. parágrafos longos quebram em sentenças até caber em ~maxChunk caracteres
 *  3. cap em N chunks para evitar spam visual
 */
export function splitForWhatsApp(text: string, maxChunk = 260, maxChunks = 4): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxChunk) {
      chunks.push(para);
      continue;
    }
    // quebra por sentenças
    const sentences = para.match(/[^.!?\n]+[.!?\n]+|\S[^.!?\n]*$/g) ?? [para];
    let current = "";
    for (const s of sentences) {
      const next = (current ? current + " " : "") + s.trim();
      if (next.length > maxChunk && current) {
        chunks.push(current.trim());
        current = s.trim();
      } else {
        current = next;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  return chunks.slice(0, maxChunks);
}

/**
 * Delay tipo "digitando", proporcional ao tamanho da mensagem.
 * ~28ms por caractere, mínimo 900ms, máximo 3.2s.
 */
export function typingDelayMs(text: string): number {
  return Math.min(3200, Math.max(900, text.length * 28));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
