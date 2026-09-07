import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";

/** Simple content page driven by i18n: info.<slug>.title / info.<slug>.body[]. */
export default function Info({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const title = t(`info.${slug}.title`, { defaultValue: slug });
  const body = t(`info.${slug}.body`, { returnObjects: true, defaultValue: [] }) as string[];
  const paras = Array.isArray(body) ? body : [String(body)];

  return (
    <AppShell breadcrumbs={[{ label: title }]}>
      <h1 className="gov-h2">{title}</h1>
      <div className="gov-panel max-w-3xl">
        <div className="gov-panel__body space-y-3 text-sm leading-relaxed text-muted-foreground">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
