import type { PropertyRow } from "./properties.js";
import type { TenantRow } from "./tenants.js";

// Feed XML no padrao VRSync (ZAP / VivaReal / Grupo OLX). O cliente cola a URL
// publica do feed na area de "integracao via XML" do portal; o portal puxa.
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TYPE_MAP: Record<string, string> = {
  apartamento: "Residential / Apartment",
  casa: "Residential / Home",
  terreno: "Residential / Land Lot",
  comercial: "Commercial / Building",
  sala: "Commercial / Office",
  cobertura: "Residential / Penthouse",
};

function propertyType(type: string): string {
  return TYPE_MAP[type.toLowerCase()] ?? "Residential / Apartment";
}

export function buildPropertyFeedXml(tenant: TenantRow, properties: PropertyRow[], publishDate: string): string {
  const listings = properties
    .filter((p) => p.status === "disponivel")
    .map((p) => {
      const tx = p.transaction === "locacao" ? "For Rent" : "For Sale";
      const features = (p.features ?? [])
        .map((f) => `        <Feature>${esc(f)}</Feature>`)
        .join("\n");
      const media = (p.photos ?? [])
        .map((url) => `      <Item medium="image" caption="">${esc(url)}</Item>`)
        .join("\n");
      const price =
        p.price_cents != null
          ? `      <ListPrice currency="BRL">${Math.round(p.price_cents / 100)}</ListPrice>`
          : "";
      const condo =
        p.condo_cents != null
          ? `      <PropertyAdministrationFee currency="BRL">${Math.round(p.condo_cents / 100)}</PropertyAdministrationFee>`
          : "";
      return `    <Listing>
      <ListingID>${esc(p.ref || String(p.id))}</ListingID>
      <Title>${esc(p.title)}</Title>
      <TransactionType>${tx}</TransactionType>
      <DateUpdated>${esc(new Date(p.updated_at).toISOString())}</DateUpdated>
      <Details>
        <PropertyType>${propertyType(p.type)}</PropertyType>
        <Description>${esc(p.description)}</Description>
${price}
${condo}
        ${p.bedrooms != null ? `<Bedrooms>${p.bedrooms}</Bedrooms>` : ""}
        ${p.bathrooms != null ? `<Bathrooms>${p.bathrooms}</Bathrooms>` : ""}
        ${p.suites != null ? `<Suites>${p.suites}</Suites>` : ""}
        ${p.parking != null ? `<Garage>${p.parking}</Garage>` : ""}
        ${p.area_m2 != null ? `<LivingArea unit="square metres">${p.area_m2}</LivingArea>` : ""}
        <Features>
${features}
        </Features>
      </Details>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="${esc(p.state)}">${esc(p.state)}</State>
        <City>${esc(p.city)}</City>
        <Neighborhood>${esc(p.neighborhood)}</Neighborhood>
        <Address>${esc(p.address)}</Address>
      </Location>
      <Media>
${media}
      </Media>
      <ContactInfo>
        <Name>${esc(tenant.owner_name || tenant.name)}</Name>
        <Telephone>${esc(tenant.owner_whatsapp_e164)}</Telephone>
      </ContactInfo>
    </Listing>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync">
  <Header>
    <Provider>${esc(tenant.name)}</Provider>
    <PublishDate>${esc(publishDate)}</PublishDate>
    <Email></Email>
    <ContactName>${esc(tenant.owner_name || tenant.name)}</ContactName>
  </Header>
  <Listings>
${listings}
  </Listings>
</ListingDataFeed>`;
}
