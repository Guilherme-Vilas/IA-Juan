import { cn } from "@/lib/utils";

// Recorta o fundo branco do PNG (overflow + scale) pra fundir no tema dark.
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
