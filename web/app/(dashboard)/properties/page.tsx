import { Header } from "@/components/layout/header";
import { getCurrentTenant } from "@/lib/tenant";
import { propertiesApi } from "@/lib/api";
import type { Property } from "@/lib/types";
import { PropertiesManager } from "./_components/properties-manager";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const tenant = await getCurrentTenant();
  let properties: Property[] = [];
  let feedUrl = "";
  let error: string | null = null;
  try {
    const [list, feed] = await Promise.all([
      propertiesApi(tenant.slug).list() as Promise<{ properties: Property[] }>,
      propertiesApi(tenant.slug).feedUrl() as Promise<{ url: string }>,
    ]);
    properties = list.properties;
    feedUrl = feed.url;
  } catch (err) {
    error = String(err);
  }

  return (
    <>
      <Header title="Imóveis" subtitle={`${tenant.name} · catálogo que a IA usa pra recomendar`} />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <PropertiesManager initial={properties} feedUrl={feedUrl} error={error} />
      </div>
    </>
  );
}
