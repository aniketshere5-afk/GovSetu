import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";

const TYPES = ["Identity proof", "Proof of address", "PAN", "GSTIN", "Constitution document", "No-objection certificate", "Other"];

function VaultInner() {
  const { t } = useTranslation();
  const vault = trpc.platform.vault.useQuery();
  const [form, setForm] = useState({ documentType: TYPES[0], referenceUrl: "" });

  const add = trpc.platform.addVaultDocument.useMutation({
    onSuccess: () => {
      toast.success(t("vault.added", "Document saved to your vault"));
      setForm({ documentType: TYPES[0], referenceUrl: "" });
      vault.refetch();
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.platform.deleteVaultDocument.useMutation({ onSuccess: () => vault.refetch() });

  return (
    <>
      <h1 className="gov-h2">{t("vault.title", "Document Vault")}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {t("vault.intro", "Save a document reference once and reuse it in any future application. SetuGov stores the locator, not the file.")}
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <form
          className="gov-panel h-max"
          onSubmit={e => {
            e.preventDefault();
            add.mutate({
              documentType: form.documentType,
              fileName: `${form.documentType.toLowerCase().replace(/\s+/g, "-")}-reference`,
              referenceUrl: form.referenceUrl.trim(),
            });
          }}
        >
          <div className="gov-panel__head">{t("vault.add", "Add a document reference")}</div>
          <div className="gov-panel__body space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              {t("vault.type", "Document type")}
              <select className="gov-input mt-1" value={form.documentType} onChange={e => setForm({ ...form, documentType: e.target.value })}>
                {TYPES.map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              {t("vault.reference", "Reference / locator")}
              <input
                className="gov-input mt-1"
                placeholder="digilocker://… or department://… or https://…"
                value={form.referenceUrl}
                onChange={e => setForm({ ...form, referenceUrl: e.target.value })}
              />
            </label>
            <button className="gov-btn gov-btn--primary" disabled={add.isPending || form.referenceUrl.trim().length < 3}>
              {t("vault.save", "Save to vault")}
            </button>
          </div>
        </form>

        <section className="gov-panel">
          <div className="gov-panel__head">{t("vault.saved", "Saved documents")}</div>
          <div className="gov-panel__body">
            {vault.data?.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            <ul className="space-y-3">
              {(vault.data ?? []).map(d => (
                <li key={d.id} className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] pb-3 last:border-0">
                  <div className="flex items-start gap-2">
                    <FileText size={15} className="mt-0.5 flex-none text-muted-foreground" aria-hidden />
                    <div>
                      <div className="text-sm font-semibold">{d.documentType}</div>
                      <div className="break-all text-xs text-muted-foreground">{d.referenceUrl}</div>
                      <div className="text-[0.68rem] text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <button className="gov-btn gov-btn--ghost" onClick={() => del.mutate({ id: d.id })} aria-label={t("vault.delete", "Remove")}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default function Vault() {
  return (
    <RequireRole roles={["user", "official", "admin"]}>
      <AppShell breadcrumbs={[{ label: "Document Vault" }]}>
        <VaultInner />
      </AppShell>
    </RequireRole>
  );
}
