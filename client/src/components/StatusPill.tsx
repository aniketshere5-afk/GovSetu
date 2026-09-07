import { appStatus, stepStatus } from "@/lib/statusMeta";

export function StatusPill({ kind, value }: { kind: "app" | "step"; value: string }) {
  const meta = kind === "app" ? appStatus(value) : stepStatus(value);
  return <span className={`gov-status gov-status--${meta.tone}`}>{meta.label}</span>;
}
