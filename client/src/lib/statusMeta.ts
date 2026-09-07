type Tone = "success" | "info" | "warning" | "danger";

const APP: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: "info", label: "Draft" },
  submitted: { tone: "info", label: "Submitted" },
  in_review: { tone: "warning", label: "In review" },
  action_required: { tone: "warning", label: "Action required" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
};

const STEP: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: "info", label: "Pending" },
  in_progress: { tone: "warning", label: "In progress" },
  completed: { tone: "success", label: "Completed" },
  blocked: { tone: "warning", label: "Action requested" },
  rejected: { tone: "danger", label: "Rejected" },
};

export function appStatus(s: string) {
  return APP[s] ?? { tone: "info" as Tone, label: s.replace(/_/g, " ") };
}
export function stepStatus(s: string) {
  return STEP[s] ?? { tone: "info" as Tone, label: s.replace(/_/g, " ") };
}
