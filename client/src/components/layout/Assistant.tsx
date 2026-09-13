import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What documents do I need for Business Registration?",
  "How do I track my application?",
  "My application status hasn't changed — is something wrong?",
];

export function Assistant() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = trpc.platform.chat.useMutation();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || chat.isPending) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    chat.mutate(
      { history: next },
      {
        onSuccess: result => setMessages(m => [...m, { role: "assistant", content: result.reply }]),
        onError: err => setError(err.message || t("assistant.error", "The assistant could not respond right now.")),
      }
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={t("assistant.toggle", "Open SetuGov assistant")}
        style={{
          position: "fixed", right: 20, bottom: 20, zIndex: 60,
          width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "var(--brand-gradient-cta)", color: "#fff", display: "grid", placeItems: "center",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {open ? <X size={22} aria-hidden /> : <Bot size={24} aria-hidden />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("assistant.title", "SetuGov Assistant")}
          style={{
            position: "fixed", right: 20, bottom: 86, zIndex: 60,
            width: "min(380px, calc(100vw - 40px))", maxHeight: "min(560px, calc(100vh - 140px))",
            display: "flex", flexDirection: "column",
            background: "var(--card)", color: "var(--card-foreground)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)", overflow: "hidden",
          }}
        >
          <div className="gov-panel__head" style={{ flex: "none" }}>
            <span className="flex items-center gap-2">
              <Bot size={16} aria-hidden /> {t("assistant.title", "SetuGov Assistant")}
            </span>
            <span className="text-xs font-normal text-muted-foreground">{t("assistant.subtitle", "Grounded in live data")}</span>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">
                  {t("assistant.intro", "Ask me anything about SetuGov's services, your applications, or something that looks broken.")}
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      className="gov-btn gov-btn--ghost"
                      style={{ justifyContent: "flex-start", width: "100%", fontWeight: 500 }}
                      onClick={() => send(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  background: m.role === "user" ? "var(--brand-gradient)" : "var(--surface-alt)",
                  color: m.role === "user" ? "#fff" : "var(--foreground)",
                  padding: "9px 13px", borderRadius: 14,
                  fontSize: "0.85rem", lineHeight: 1.5, whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}

            {chat.isPending && (
              <div style={{ alignSelf: "flex-start", color: "var(--muted-foreground)", fontSize: "0.82rem" }}>
                {t("assistant.thinking", "Checking live data…")}
              </div>
            )}

            {error && (
              <div className="gov-status gov-status--danger" style={{ alignSelf: "flex-start" }}>
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              send(draft);
            }}
            style={{ flex: "none", display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}
          >
            <input
              className="gov-input"
              placeholder={t("assistant.placeholder", "Type your question…")}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              aria-label={t("assistant.placeholder", "Type your question…")}
            />
            <button type="submit" className="gov-btn gov-btn--primary" disabled={chat.isPending || !draft.trim()} aria-label={t("assistant.send", "Send")}>
              <Send size={15} aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
