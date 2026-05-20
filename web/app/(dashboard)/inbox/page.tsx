import { Header } from "@/components/layout/header";

export default function InboxPage() {
  return (
    <>
      <Header title="Inbox" subtitle="Ações que precisam do Juan" />
      <div className="grid flex-1 place-items-center text-sm text-ink-muted">
        Em construção — leads que precisam de atenção apareceriam aqui.
      </div>
    </>
  );
}
