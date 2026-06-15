# Marca — Vita OS

Coloque os arquivos da logo do SaaS **Vita OS** nesta pasta. O Next.js serve
tudo aqui em `/brand/...` (ex: `web/public/brand/logo.svg` → `https://app/brand/logo.svg`).

## Arquivos esperados (use estes nomes pra plugar direto na UI)

| Arquivo | Uso | Formato ideal |
|---|---|---|
| `logo.svg` | Logo principal (símbolo + wordmark) | SVG (escala sem perder qualidade) |
| `logo-mark.svg` | Só o símbolo (ícone) — pra sidebar/favicon | SVG quadrado |
| `logo-light.svg` | Versão pra fundo escuro (tema atual) | SVG, traços claros |
| `logo-dark.svg` | Versão pra fundo claro (futuro tema light) | SVG, traços escuros |
| `favicon.ico` ou `icon.png` | Aba do navegador | 32×32 / 512×512 |
| `og-image.png` | Preview ao compartilhar link | 1200×630 |

## Observações

- **Tema atual é dark** (`#0A0A0C`): a logo precisa ter contraste em fundo escuro.
  Priorize `logo-light.svg` / `logo-mark.svg` com traços em branco gelo (`#E6E6E6`)
  ou bronze (`#B08D57`), combinando com a identidade Apple Dark + Claude.
- SVG é fortemente preferível (nitidez em qualquer DPI e troca de cor por CSS).
- Quando os arquivos estiverem aqui, me avise que eu pluго na **sidebar**, no
  **header**, no **favicon** (`app/layout.tsx`) e na tela de **login** —
  substituindo o "S" provisório e o wordmark "Stella" por "Vita OS".
