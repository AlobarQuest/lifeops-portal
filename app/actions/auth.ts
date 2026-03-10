"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSessionToken,
  getConfiguredEmail,
  isAuthConfigured,
} from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  if (!isAuthConfigured()) {
    redirect("/login?error=missing-config");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (email !== getConfiguredEmail()) {
    redirect(`/login?error=invalid&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const { verifyOwnerLogin } = await import("@/lib/owner-auth");
  const loginResult = await verifyOwnerLogin(email, password);

  if (!loginResult.ok) {
    const error = loginResult.reason === "missing-bootstrap-password" ? "missing-bootstrap-password" : "invalid";
    redirect(`/login?error=${error}&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const token = await createSessionToken(email);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}
