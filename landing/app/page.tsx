import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { ProductPreview } from "@/components/product-preview";
import { AgentDemo } from "@/components/agent-demo";
import { Segments } from "@/components/segments";
import { Faq } from "@/components/faq";
import { CtaFooter } from "@/components/cta-footer";
import { WhatsappFab } from "@/components/whatsapp-fab";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <ProductPreview />
      <AgentDemo />
      <Segments />
      <Faq />
      <CtaFooter />
      <WhatsappFab />
    </main>
  );
}
