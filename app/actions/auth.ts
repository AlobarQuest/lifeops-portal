"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSessionToken,
  getConfiguredEmail,
  getConfiguredPassword,
  isAuthConfigured,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  if (!isAuthConfigured()) {
    redirect("/login?error=missing-config");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (email !== getConfiguredEmail() || password !== getConfiguredPassword()) {
    redirect(`/login?error=invalid&redirectTo=${encodeURIComponent(redirectTo)}`);
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

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

