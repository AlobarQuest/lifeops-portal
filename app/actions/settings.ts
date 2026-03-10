"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    nextPassword: z.string().min(12, "Use at least 12 characters for the new password."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .superRefine((value, context) => {
    if (value.nextPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The new password confirmation does not match.",
      });
    }

    if (value.currentPassword === value.nextPassword) {
      context.addIssue({
        code: "custom",
        path: ["nextPassword"],
        message: "Choose a new password instead of reusing the current one.",
      });
    }
  });

export type PasswordChangeState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialPasswordChangeState: PasswordChangeState = {
  status: "idle",
  message: "",
};

export async function changePasswordAction(
  _previousState: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    nextPassword: String(formData.get("nextPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the password fields and try again.",
    };
  }

  const { changeOwnerPassword } = await import("@/lib/owner-auth");
  const result = await changeOwnerPassword(
    session.email,
    parsed.data.currentPassword,
    parsed.data.nextPassword,
  );

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "invalid-current-password"
          ? "The current password did not match the owner account."
          : "The signed-in owner account could not be found.",
    };
  }

  return {
    status: "success",
    message: "Password updated. Use the new password the next time you sign in.",
  };
}
