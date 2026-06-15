import { cn } from "@/lib/utils";

// A logo PNG tem fundo branco em volta do tile escuro. Pra usar em fundo escuro,
// renderizamos dentro de um container `overflow-hidden rounded` e damos um leve
// scale na imagem — o fundo branco e empurrado pra fora e so o tile (escuro) +
// o "V" bronze ficam visiveis, fundindo com o tema.
export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-md", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/vitaos-logo.png"
        alt="Vita OS"
        className="h-full w-full scale-[1.6] object-cover"
        draggable={false}
      />
    </div>
  );
}
