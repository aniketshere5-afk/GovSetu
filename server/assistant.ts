import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { getDb, listApplications, systemHealth, applications, services, departments } from "./db";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export class AssistantNotConfiguredError extends Error {
  constructor() {
    super("The assistant is not configured on this deployment. Set ANTHROPIC_API_KEY (or the built-in Forge proxy) to enable it.");
    this.name = "AssistantNotConfiguredError";
  }
}

/** Direct Anthropic Messages API call — used when no Forge proxy key is set. */
async function invokeAnthropic(system: string, messages: ChatMessage[]): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ENV.anthropicModel,
      max_tokens: 700,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${response.statusText} – ${text}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter(part => part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("Anthropic response contained no text");
  return text;
}

/** Google Gemini generateContent call — used when neither Forge nor Anthropic is configured. */
async function invokeGemini(system: string, messages: ChatMessage[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ENV.geminiModel}:generateContent?key=${ENV.geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: system }] },
      contents: messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 700 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText} – ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const geminiText = (data.candidates?.[0]?.content?.parts ?? [])
    .map(p => p.text ?? "")
    .join("\n")
    .trim();

  if (!geminiText) throw new Error("Gemini response contained no text");
  return geminiText;
}

/** Real, DB-backed knowledge of the platform — never fabricated. */
async function buildGroundingContext(user: { id: number; role: string; departmentId: number | null } | null): Promise<string> {
  const db = await getDb();
  const health = await systemHealth();

  if (!db) {
    return [
      "LIVE SYSTEM STATE: the application database is currently unreachable.",
      `Health check reports: ${JSON.stringify(health)}.`,
      "Do not describe any service catalogue, application, or figure as if it were live data right now — tell the user the platform data layer is temporarily unavailable and to retry shortly.",
    ].join("\n");
  }

  const [serviceRows, deptRows] = await Promise.all([
    db.select().from(services),
    db.select().from(departments),
  ]);

  const serviceLines = serviceRows.map(s =>
    `- "${s.name}" (slug: ${s.slug}, status: ${s.status}) — expected turnaround ${s.expectedDays} working days. Eligibility: ${s.eligibility}. Required documents: ${s.requiredDocuments}.`
  );

  const deptLines = deptRows.map(d => `- ${d.name} (${d.code}), status: ${d.status}, source system: ${d.sourceSystem}`);

  const sections = [
    "LIVE SYSTEM STATE (ground every factual claim in this, never invent a service, department, or status not listed here):",
    `Platform health: database=${health.database}, seeded=${health.seeded}, total applications on record=${health.applications}.`,
    "",
    "Services currently offered:",
    ...(serviceLines.length ? serviceLines : ["(none configured)"]),
    "",
    "Departments connected to the platform:",
    ...(deptLines.length ? deptLines : ["(none configured)"]),
  ];

  if (user) {
    const apps = await listApplications(user.id, user.role, user.departmentId ?? undefined);
    if (user.role === "user") {
      sections.push("", `This visitor is signed in as a citizen (user id ${user.id}). Their applications:`);
      if (apps.length === 0) {
        sections.push("(they have not submitted any application yet)");
      } else {
        for (const a of apps as Array<typeof applications.$inferSelect>) {
          sections.push(`- #${a.applicationNumber}: "${a.businessName}" — status: ${a.status}, last updated ${a.updatedAt?.toISOString?.() ?? a.updatedAt}.`);
        }
      }
    } else if (user.role === "official") {
      sections.push("", `This visitor is signed in as a department official (department id ${user.departmentId ?? "unknown"}). Their work queue currently has ${apps.length} application(s) awaiting action.`);
    } else if (user.role === "admin") {
      sections.push("", "This visitor is signed in as a platform administrator — they can see connectors, analytics, the audit trail, users and grievances under /admin.");
    }
  } else {
    sections.push("", "This visitor is not signed in. To apply for a service, track an application, manage consent, or use the document vault they must sign in first (the Login button).");
  }

  return sections.join("\n");
}

const NAV_MAP = [
  "/ — Home: service catalogue preview, live dashboard stats, notices.",
  "/services — full service directory.",
  "/services/:slug — one service's detail page (eligibility, documents, timeline, start application).",
  "/apply/:slug — multi-step application form for a service (signed-in citizens).",
  "/track — track an application by its application number.",
  "/consent — citizens manage which departments may access which data scopes.",
  "/vault — citizens' document vault (upload/remove reference documents).",
  "/grievance — file or view grievances about a service/application.",
  "/work — department officials' work queue (approve/reject/request info on routed applications).",
  "/admin — administrators: connectors, analytics, audit trail, users, grievances.",
].join("\n");

const SYSTEM_PROMPT_HEADER = `You are the SetuGov Assistant, built into the SetuGov unified government-services platform (a Smart India Hackathon prototype for Maharashtra). SetuGov lets a citizen submit one application that is routed to every department that must act on it, with consent-gated data sharing and a public audit trail.

Your job: give citizens, officials and admins precise, accurate help navigating and using the actual app — and when someone reports something broken, help them pin down the real cause using the live system state given to you, not guesses.

Rules:
- Only state facts about services, departments, or a user's own applications that appear in the LIVE SYSTEM STATE block below. If something isn't listed, say you don't have that information rather than inventing it.
- When a user describes a bug (a stuck status, an error, a missing button), first check whether the LIVE SYSTEM STATE explains it (e.g. database unavailable, application status, which department it's routed to). If it doesn't explain it, ask one precise clarifying question (exact page URL, what they clicked, any error text) instead of speculating.
- Point to exact routes using this navigation map when telling someone where to go:
${NAV_MAP}
- Be concise: short paragraphs or a short bulleted list, no filler, no repeating the question back.
- Never claim to take actions on the user's behalf (you cannot submit forms, change data, or fix bugs yourself) — tell them exactly which button/page to use.`;

export async function chatWithAssistant(
  history: ChatMessage[],
  user: { id: number; role: string; departmentId: number | null } | null
): Promise<string> {
  const hasForge = Boolean(ENV.forgeApiKey);
  const hasAnthropic = Boolean(ENV.anthropicApiKey);
  const hasGemini = Boolean(ENV.geminiApiKey);
  if (!hasForge && !hasAnthropic && !hasGemini) throw new AssistantNotConfiguredError();

  const grounding = await buildGroundingContext(user);
  const system = `${SYSTEM_PROMPT_HEADER}\n\n${grounding}`;

  const trimmedHistory = history.slice(-12);

  if (hasForge) {
    const result = await invokeLLM({
      messages: [{ role: "system", content: system }, ...trimmedHistory.map(m => ({ role: m.role, content: m.content }))],
      maxTokens: 700,
    });
    const reply = result.choices?.[0]?.message?.content;
    const text = typeof reply === "string" ? reply : Array.isArray(reply) ? reply.map(p => ("text" in p ? p.text : "")).join("\n") : "";
    if (!text.trim()) throw new Error("Assistant returned an empty response");
    return text.trim();
  }

  if (hasAnthropic) {
    return invokeAnthropic(system, trimmedHistory);
  }

  return invokeGemini(system, trimmedHistory);
}
