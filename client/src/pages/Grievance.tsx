import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";

const CATEGORIES = ["Delay", "Incorrect information", "Consent / data", "Technical issue", "Other"];

function GrievanceInner() {
  const { t } = useTranslation();
  const mine = trpc.platform.myGrievances.useQuery();
  const apps = trpc.platform.applications.useQuery();
  const [form, setForm] = useState({ category: CATEGORIES[0], subject: "", body: "", applicationId: "" });

  const file = trpc.platform.fileGrievance.useMutation({
    onSuccess: r => {
      toast.success(t("grievance.filed", { defaultValue: "Grievance {{n}} registered", n: r.ticketNumber }));
      setForm({ category: CATEGORIES[0], subject: "", body: "", applicationId: "" });
      mine.refetch();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <>
      <h1 className="gov-h2">{t("grievance.title", "Grievance Redressal")}</h1>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <form
          className="gov-panel"
          onSubmit={e => {
            e.preventDefault();
            file.mutate({
              category: form.category,
              subject: form.subject,
              body: form.body,
              applicationId: form.applicationId ? Number(form.applicationId) : undefined,
            });
          }}
        >
          <div className="gov-panel__head">{t("grievance.new", "Raise a grievance")}</div>
          <div className="gov-panel__body space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              {t("grievance.category", "Category")}
              <select className="gov-input mt-1" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              {t("grievance.relatedApp", "Related application (optional)")}
              <select className="gov-input mt-1" value={form.applicationId} onChange={e => setForm({ ...form, applicationId: e.target.value })}>
                <option value="">—</option>
                {(apps.data ?? []).map(a => <option key={a.id} value={a.id}>{a.applicationNumber}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              {t("grievance.subject", "Subject")}
              <input className="gov-input mt-1" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              {t("grievance.details", "Details")}
              <textarea className="gov-input mt-1" rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
            </label>
            <button
              className="gov-btn gov-btn--primary"
              disabled={file.isPending || form.subject.length < 4 || form.body.length < 10}
            >
              {file.isPending ? t("grievance.submitting", "Submitting…") : t("grievance.submit", "Submit grievance")}
            </button>
          </div>
        </form>

        <section className="gov-panel h-max">
          <div className="gov-panel__head">{t("grievance.mine", "My grievances")}</div>
          <div className="gov-panel__body">
            {mine.data?.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            <ul className="space-y-3">
              {(mine.data ?? []).map(g => (
                <li key={g.id} className="border-b border-[color:var(--border)] pb-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono">{g.ticketNumber}</span>
                    <span className="font-semibold">{g.subject}</span>
                    <span className={`gov-status gov-status--${g.status === "resolved" || g.status === "closed" ? "success" : "warning"}`}>{g.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{g.category} · {new Date(g.createdAt).toLocaleDateString()}</div>
                  {g.response && <div className="mt-1 text-xs">↳ {g.response}</div>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default function Grievance() {
  return (
    <RequireRole roles={["user", "official", "admin"]}>
      <AppShell breadcrumbs={[{ label: "Grievance Redressal" }]}>
        <GrievanceInner />
      </AppShell>
    </RequireRole>
  );
}
