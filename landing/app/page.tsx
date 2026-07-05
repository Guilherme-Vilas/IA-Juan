import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { ProductPreview } from "@/components/product-preview";
import { DemoStella } from "@/components/demo-stella";
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
      <DemoStella />
      <Segments />
      <Faq />
      <CtaFooter />
      <WhatsappFab />
    </main>
  );
}
