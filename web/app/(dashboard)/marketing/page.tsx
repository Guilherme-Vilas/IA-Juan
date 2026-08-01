import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/session";
import { MarketingHub } from "./_components/marketing-hub";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_superadmin) redirect("/leads");

  return (
    <>
      <Header
        title="Marketing"
        subtitle="Sua máquina de nutrição — e-mails para interessados na Vita OS"
      />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <MarketingHub />
      </div>
    </>
  );
}
