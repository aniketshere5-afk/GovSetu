import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { applications, workflowSteps } from "../drizzle/schema";
import { getDb } from "./db";
import { writeAudit } from "./audit";
import { notifyUser } from "./notify";

export type StepAction = "start" | "complete" | "request_action" | "reject";

export type Actor = {
  id: number;
  role: "user" | "official" | "admin";
  departmentId: number | null;
};

export type TransitionResult = {
  success: true;
  stepStatus: "in_progress" | "completed" | "blocked" | "rejected";
  nextDepartmentId: number | null;
  finalStatus?: "approved" | "rejected";
};

function slaDueDate(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/**
 * Single entry point for workflow-step state changes. Keeps the routing rules,
 * application-status derivation and audit/notification side effects in one place
 * instead of scattered `if` branches.
 */
export async function transitionStep(
  actor: Actor,
  stepId: number,
  action: StepAction,
  remarks: string | undefined,
): Promise<TransitionResult> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const [step] = await db.select().from(workflowSteps).where(eq(workflowSteps.id, stepId));
  if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow step not found" });

  if (actor.role === "official" && actor.departmentId && step.departmentId !== actor.departmentId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This milestone belongs to another department" });
  }

  const [app] = await db.select().from(applications).where(eq(applications.id, step.applicationId));
  if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

  if (["completed", "rejected"].includes(step.status)) {
    throw new TRPCError({ code: "CONFLICT", message: `Step is already ${step.status}` });
  }
  if ((action === "request_action" || action === "reject") && !remarks?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A remark is required for this decision" });
  }

  const now = new Date();
  const allSteps = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.applicationId, step.applicationId))
    .orderBy(asc(workflowSteps.sequence));
  const nextStep = allSteps.find(s => s.sequence > step.sequence && s.status === "pending") ?? null;

  let result: TransitionResult;

  if (action === "start") {
    await db
      .update(workflowSteps)
      .set({ status: "in_progress", startedAt: step.startedAt ?? now })
      .where(eq(workflowSteps.id, stepId));
    await db.update(applications).set({ status: "in_review" }).where(eq(applications.id, app.id));
    result = { success: true, stepStatus: "in_progress", nextDepartmentId: null };
  } else if (action === "request_action") {
    // Never clears an existing completedAt.
    await db
      .update(workflowSteps)
      .set({ status: "blocked", remarks })
      .where(eq(workflowSteps.id, stepId));
    await db.update(applications).set({ status: "action_required" }).where(eq(applications.id, app.id));
    await notifyUser({
      userId: app.applicantId,
      applicationId: app.id,
      type: "action_required",
      title: `${app.applicationNumber}: action needed`,
      body: remarks,
    });
    result = { success: true, stepStatus: "blocked", nextDepartmentId: null };
  } else if (action === "reject") {
    await db
      .update(workflowSteps)
      .set({ status: "rejected", remarks, completedAt: now })
      .where(eq(workflowSteps.id, stepId));
    await db
      .update(applications)
      .set({ status: "rejected", currentDepartmentId: null, decidedAt: now })
      .where(eq(applications.id, app.id));
    await notifyUser({
      userId: app.applicantId,
      applicationId: app.id,
      type: "rejected",
      title: `${app.applicationNumber}: rejected`,
      body: remarks,
    });
    result = { success: true, stepStatus: "rejected", nextDepartmentId: null, finalStatus: "rejected" };
  } else {
    // complete
    await db
      .update(workflowSteps)
      .set({ status: "completed", remarks: remarks ?? step.remarks, completedAt: now })
      .where(eq(workflowSteps.id, stepId));

    if (nextStep) {
      await db
        .update(workflowSteps)
        .set({ status: "in_progress", startedAt: now, slaDueAt: slaDueDate(3) })
        .where(eq(workflowSteps.id, nextStep.id));
      await db
        .update(applications)
        .set({ status: "in_review", currentDepartmentId: nextStep.departmentId })
        .where(eq(applications.id, app.id));
      await notifyUser({
        userId: app.applicantId,
        applicationId: app.id,
        type: "routed",
        title: `${app.applicationNumber}: moved to the next department`,
      });
      result = { success: true, stepStatus: "completed", nextDepartmentId: nextStep.departmentId };
    } else {
      await db
        .update(applications)
        .set({ status: "approved", currentDepartmentId: null, decidedAt: now })
        .where(eq(applications.id, app.id));
      await notifyUser({
        userId: app.applicantId,
        applicationId: app.id,
        type: "approved",
        title: `${app.applicationNumber}: approved`,
      });
      result = { success: true, stepStatus: "completed", nextDepartmentId: null, finalStatus: "approved" };
    }
  }

  await writeAudit(
    actor.id,
    actor.role,
    `workflow.${action}`,
    "workflow_step",
    String(stepId),
    remarks ?? null,
  );
  return result;
}
