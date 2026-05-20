export type ExtractedCall = { name: string; args: Record<string, unknown> };

/**
 * Llama ocasionalmente emite tool calls como texto em vez de usar o campo
 * tool_calls estruturado. Formatos vistos:
 *   <function>name{json}</function>
 *   <function=name>{json}</function>
 *   <function name="x">{json}</function>
 *   <|python_tag|>name.call({...})
 *
 * Esta função remove esses blocos do texto e devolve os calls extraídos
 * para que o FSM possa aplicar os efeitos (save_slots, advance_state...).
 */
export function sanitizeReply(text: string): { clean: string; calls: ExtractedCall[] } {
  if (!text) return { clean: "", calls: [] };
  const calls: ExtractedCall[] = [];

  let out = text;

  // <function ...>INNER</function>
  out = out.replace(/<function\b[^>]*>([\s\S]*?)<\/function>/gi, (_m, inner: string) => {
    tryExtract(inner, calls);
    return "";
  });

  // <|python_tag|>name({...}) ou <|python_tag|>name.call({...})
  out = out.replace(
    /<\|python_tag\|>\s*([a-zA-Z_][\w.]*)\s*(?:\.call)?\s*\(([\s\S]*?)\)/g,
    (_m, name: string, argsStr: string) => {
      const args = tryParseJson(argsStr);
      if (args) calls.push({ name: name.replace(/\.call$/, ""), args });
      return "";
    },
  );

  // tool_call como JSON solto: {"name":"x","arguments":{...}}
  out = out.replace(
    /\{\s*"name"\s*:\s*"([a-zA-Z_]\w*)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g,
    (_m, name: string, argsStr: string) => {
      const args = tryParseJson(argsStr);
      if (args) calls.push({ name, args });
      return "";
    },
  );

  // remove linhas em branco extras e trim
  const clean = out.replace(/\n{3,}/g, "\n\n").trim();
  return { clean, calls };
}

function tryExtract(inner: string, calls: ExtractedCall[]) {
  // formato: name{json}
  const m = inner.match(/^\s*([a-zA-Z_]\w*)\s*(\{[\s\S]*\})\s*$/);
  if (m) {
    const args = tryParseJson(m[2]!);
    if (args) calls.push({ name: m[1]!, args });
    return;
  }
  // formato: name="x">{json}  (já fora da regex principal; aqui só tentamos json puro)
  const mJson = inner.match(/\{[\s\S]*\}/);
  if (mJson) {
    const args = tryParseJson(mJson[0]);
    if (args) calls.push({ name: "unknown", args });
  }
}

function tryParseJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
