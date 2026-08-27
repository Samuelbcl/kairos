"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaces, WORKSPACE_COOKIE } from "@/lib/workspace";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const switchSchema = z.object({ workspaceId: z.uuid() });

/** Change l'espace actif. Refuse tout espace dont l'utilisateur n'est pas membre. */
export async function switchWorkspace(
  workspaceId: string,
): Promise<ActionResult> {
  const parsed = switchSchema.safeParse({ workspaceId });
  if (!parsed.success) {
    return { ok: false, error: "Identifiant d'espace invalide." };
  }

  const workspaces = await getWorkspaces();
  if (!workspaces.some((w) => w.id === parsed.data.workspaceId)) {
    return { ok: false, error: "Tu n'as pas accès à cet espace." };
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, parsed.data.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
