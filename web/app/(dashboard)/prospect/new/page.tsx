import { Header } from "@/components/layout/header";
import { NewCampaignForm } from "./_components/new-campaign-form";

export default function NewCampaignPage() {
  return (
    <>
      <Header title="Nova campanha" subtitle="Configure canal, mensagem e cadência" />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <NewCampaignForm />
      </div>
    </>
  );
}
