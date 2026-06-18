import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "vita_session";

// Gate de presença: sem cookie de sessão -> manda pro /login.
// A validação REAL do JWT acontece no servidor (getSession -> /auth/me) e no
// Fastify (que 401 se o token for inválido). Aqui só evitamos renderizar o
// shell do dashboard pra quem não está logado.
export function middleware(req: NextRequest) {
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protege tudo, EXCETO: /login, /invite (onboarding público), as rotas de auth,
// o proxy público de convite, assets estáticos e o favicon.
export const config = {
  matcher: [
    "/((?!login|invite|api/auth|api/invite|_next/static|_next/image|favicon.ico|brand|icon.png).*)",
  ],
};
