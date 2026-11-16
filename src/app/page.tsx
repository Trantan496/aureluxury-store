import { CollectionReveal } from "@/components/home/collection-reveal";
import { CollectionSection } from "@/components/home/collection-section";
import { HeroSection } from "@/components/home/hero-section";
import { IntelligenceShowcase } from "@/components/home/intelligence-showcase";
import { getCatalog } from "@/lib/catalog";
import { EditorialDiscovery } from "@/components/home/editorial-sections";
import { AurelEdit } from "@/components/home/aurel-edit";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getCatalog({ q: "", category: "", invalid: false });
  return (
    <>
      <CollectionReveal hero={<HeroSection />}>
        <IntelligenceShowcase />
        <CollectionSection result={result} />
      </CollectionReveal>
      <EditorialDiscovery />
      <AurelEdit />
    </>
  );
}
