"use server";

// Sign-in for the /admin gate (see accessGate.ts for the whole rationale). The
// operator submits the shared ADMIN_TOKEN through a plain <form action={…}> —
// no client component, no token in any client bundle, works without JavaScript.
//
// The value is stored in an httpOnly, /admin-scoped session cookie and verified
// on EVERY subsequent request by readAdminGate(); this action deliberately does
// not decide access itself, so there is exactly one place that grants it.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "./accessGate";

export async function submitAdminToken(formData: FormData): Promise<void> {
  const raw = formData.get("token");
  const token = typeof raw === "string" ? raw.trim() : "";

  const jar = await cookies();
  if (!token) {
    // Nothing submitted — clear any stale cookie and fall back to the locked
    // door rather than recording an empty "attempt".
    jar.delete({ name: ADMIN_COOKIE, path: "/admin" });
  } else {
    // Stored unverified on purpose: the cookie is only ever an input to the
    // constant-time comparison in readAdminGate(), never a grant in itself. A
    // wrong value therefore renders the honest "unauthorized" state instead of
    // needing a second, spoofable error channel in the URL.
    jar.set({
      name: ADMIN_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      // Scoped to the console — the token is never attached to a public request.
      path: "/admin",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_COOKIE_MAX_AGE,
    });
  }

  // Outside any try/catch: redirect() signals by throwing (NEXT_REDIRECT).
  redirect("/admin");
}
