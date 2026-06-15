import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { Segments } from "@/components/segments";
import { CtaFooter } from "@/components/cta-footer";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Segments />
      <CtaFooter />
    </main>
  );
}
