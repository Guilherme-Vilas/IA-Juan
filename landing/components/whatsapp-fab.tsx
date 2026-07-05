import { MessageCircle } from "lucide-react";
import { SITE, waLink } from "@/lib/site";

// Botão flutuante de WhatsApp — só aparece com o número comercial configurado.
export function WhatsappFab() {
  if (!SITE.contactWhatsapp) return null;
  return (
    <a
      href={waLink(SITE.contactWhatsapp, "Olá! Vim pelo site da Vita OS.")}
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-[52px] w-[52px] place-items-center rounded-full bg-[#25D366] text-white shadow-elevated transition-transform hover:scale-105"
    >
      <MessageCircle size={24} />
    </a>
  );
}
