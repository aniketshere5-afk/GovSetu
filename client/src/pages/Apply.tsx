import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Check, UploadCloud } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { uploadFile } from "@/lib/upload";

function ApplyInner() {
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const [, navigate] = useLocation();
  const detail = trpc.platform.serviceDetail.useQuery({ slug }, { enabled: Boolean(slug) });
  const vault = trpc.platform.vault.useQuery();
  const create = trpc.platform.createApplication.useMutation({
    onSuccess: res => {
      toast.success(t("apply.submitted", { defaultValue: "Application {{n}} submitted", n: res.applicationNumber }));
      navigate(`/applications/${res.id}`);
    },
    onError: e => toast.error(e.message),
  });

  const scopes = useMemo(
    () => Array.from(new Set((detail.data?.route ?? []).map(r => r.requiredScope).filter(Boolean))) as string[],
    [detail.data],
  );

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ businessName: "", businessType: "Private Limited", address: "", contact: "" });
  const [docRefs, setDocRefs] = useState<Record<string, string>>({});
  const [docFileNames, setDocFileNames] = useState<Record<string, string>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  const handleDocUpload = async (doc: string, file: File | undefined) => {
    if (!file) return;
    setUploadingDoc(doc);
    try {
      const result = await uploadFile(file);
      setDocRefs(prev => ({ ...prev, [doc]: result.url }));
      setDocFileNames(prev => ({ ...prev, [doc]: result.fileName }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("apply.uploadFailed", "Upload failed"));
    } finally {
      setUploadingDoc(null);
      const input = fileInputs.current[doc];
      if (input) input.value = "";
    }
  };

  if (detail.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!detail.data) {
    return <div className="gov-panel max-w-lg"><div className="gov-panel__body text-sm text-muted-foreground">{t("serviceDetail.notFound", "This service could not be found.")}</div></div>;
  }
  const { service, requiredDocuments } = detail.data;

  const allScopesGranted = scopes.every(s => granted[s]);
  const step0Valid = form.businessName.length >= 2 && form.businessType.length >= 2 && form.address.length >= 8 && /.+@.+\..+/.test(form.contact);

  const steps = [t("apply.step1", "Applicant details"), t("apply.step2", "Documents & consent"), t("apply.step3", "Review & submit")];

  const submit = () => {
    create.mutate({
      serviceId: service.id,
      businessName: form.businessName,
      businessType: form.businessType,
      address: form.address,
      contact: form.contact,
      consentScopes: scopes,
      documents: requiredDocuments
        .filter(d => docRefs[d]?.trim())
        .map(d => ({
          type: d,
          fileName: docFileNames[d] ?? `${d.toLowerCase().replace(/\s+/g, "-")}-reference`,
          referenceUrl: docRefs[d].trim(),
        })),
    });
  };

  return (
    <>
      <h1 className="gov-h2">{t("apply.title", "Apply")}: {service.name}</h1>

      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 border px-3 py-1.5 ${i === step ? "border-[color:var(--gov-blue)] font-semibold text-foreground" : "border-[color:var(--border)] text-muted-foreground"}`}
          >
            <span className="gov-step__n" style={{ width: 18, height: 18, fontSize: "0.66rem" }}>
              {i < step ? <Check size={11} /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="gov-panel max-w-2xl">
        <div className="gov-panel__body space-y-4">
          {step === 0 && (
            <>
              <Field label={t("apply.businessName", "Business / entity name")}>
                <input className="gov-input" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} />
              </Field>
              <Field label={t("apply.businessType", "Entity type")}>
                <input className="gov-input" value={form.businessType} onChange={e => setForm({ ...form, businessType: e.target.value })} />
              </Field>
              <Field label={t("apply.address", "Registered address")}>
                <textarea className="gov-input" rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label={t("apply.contact", "Contact email")}>
                <input className="gov-input" type="email" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <div className="mb-2 text-sm font-semibold">{t("apply.docRefs", "Documents")}</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("apply.docHint", "Upload each document, pick one you already saved to your vault, or paste a DigiLocker/department locator.")}
                </p>
                <div className="space-y-3">
                  {requiredDocuments.map(doc => {
                    const matches = (vault.data ?? []).filter(
                      v => v.documentType.toLowerCase() === doc.toLowerCase() || doc.toLowerCase().includes(v.documentType.toLowerCase()),
                    );
                    const isUploaded = docRefs[doc]?.startsWith("/uploads/");
                    return (
                      <Field key={doc} label={doc}>
                        <div className="flex gap-2">
                          <input
                            className="gov-input"
                            placeholder="digilocker://… or department://…"
                            value={isUploaded ? (docFileNames[doc] ?? docRefs[doc]) : (docRefs[doc] ?? "")}
                            readOnly={isUploaded}
                            onChange={e => setDocRefs({ ...docRefs, [doc]: e.target.value })}
                          />
                          <input
                            ref={el => { fileInputs.current[doc] = el; }}
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={e => handleDocUpload(doc, e.target.files?.[0])}
                          />
                          <button
                            type="button"
                            className="gov-btn gov-btn--ghost flex-none"
                            disabled={uploadingDoc === doc}
                            onClick={() => fileInputs.current[doc]?.click()}
                          >
                            <UploadCloud size={13} aria-hidden />
                            {uploadingDoc === doc ? t("apply.uploading", "…") : t("apply.upload", "Upload")}
                          </button>
                        </div>
                        {matches.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {matches.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                className="border border-[color:var(--border)] px-2 py-0.5 text-[0.7rem]"
                                onClick={() => {
                                  setDocRefs({ ...docRefs, [doc]: m.referenceUrl ?? "" });
                                  setDocFileNames({ ...docFileNames, [doc]: m.fileName });
                                }}
                              >
                                {t("apply.fromVault", "From vault")}: {m.fileName}
                              </button>
                            ))}
                          </div>
                        )}
                      </Field>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">{t("apply.consent", "Purpose-limited consent")}</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("apply.consentHint", "Each department may use only the data you grant here. You can withdraw any of these later.")}
                </p>
                <div className="space-y-2">
                  {scopes.map(scope => (
                    <label key={scope} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={Boolean(granted[scope])}
                        onChange={e => setGranted({ ...granted, [scope]: e.target.checked })}
                      />
                      <span>
                        {t("apply.allowUse", { defaultValue: "Allow departments to verify my {{scope}}", scope })}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <dl className="space-y-2 text-sm">
              <Row k={t("apply.businessName", "Business / entity name")} v={form.businessName} />
              <Row k={t("apply.businessType", "Entity type")} v={form.businessType} />
              <Row k={t("apply.address", "Registered address")} v={form.address} />
              <Row k={t("apply.contact", "Contact email")} v={form.contact} />
              <Row k={t("apply.consent", "Consent granted")} v={scopes.join(", ")} />
              <Row
                k={t("apply.docRefs", "Document references")}
                v={requiredDocuments.filter(d => docRefs[d]?.trim()).join(", ") || t("apply.none", "None provided")}
              />
            </dl>
          )}

          {step === 0 && !step0Valid && (
            <p className="text-xs text-muted-foreground">
              {t("apply.step0Hint", "Fill in the business name, entity type, a full address (8+ characters) and a valid email to continue.")}
            </p>
          )}
          {step === 1 && !allScopesGranted && (
            <p className="text-xs text-muted-foreground">
              {t("apply.step1Hint", "Grant every consent checkbox above to continue — each department can only act once you've allowed it to verify its scope.")}
            </p>
          )}

          <div className="flex justify-between pt-2">
            <button className="gov-btn gov-btn--ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
              {t("apply.back", "Back")}
            </button>
            {step < 2 ? (
              <button
                className="gov-btn gov-btn--primary"
                disabled={(step === 0 && !step0Valid) || (step === 1 && !allScopesGranted)}
                onClick={() => setStep(s => s + 1)}
              >
                {t("apply.next", "Next")}
              </button>
            ) : (
              <button className="gov-btn gov-btn--primary" disabled={create.isPending} onClick={submit}>
                {create.isPending ? t("apply.submitting", "Submitting…") : t("apply.submit", "Submit application")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-b border-[color:var(--border)] pb-2">
      <dt className="w-40 flex-none text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="flex-1">{v}</dd>
    </div>
  );
}

export default function Apply() {
  return (
    <RequireRole roles={["user", "official", "admin"]}>
      <AppShell breadcrumbs={[{ label: "Apply" }]}>
        <ApplyInner />
      </AppShell>
    </RequireRole>
  );
}
