"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  initialPasswordChangeState,
} from "@/app/actions/settings";

type PasswordChangeFormProps = {
  ownerEmail: string;
};

export function PasswordChangeForm({ ownerEmail }: PasswordChangeFormProps) {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialPasswordChangeState,
  );

  return (
    <form action={formAction} className="password-form">
      <div className="list-item">
        <strong>Owner account</strong>
        <p>{ownerEmail}</p>
      </div>

      {state.status === "error" ? <div className="error-banner">{state.message}</div> : null}
      {state.status === "success" ? <div className="success-banner">{state.message}</div> : null}

      <div className="field">
        <label htmlFor="currentPassword">Current password</label>
        <input
          autoComplete="current-password"
          id="currentPassword"
          name="currentPassword"
          required
          type="password"
        />
      </div>

      <div className="field">
        <label htmlFor="nextPassword">New password</label>
        <input
          autoComplete="new-password"
          id="nextPassword"
          name="nextPassword"
          minLength={12}
          required
          type="password"
        />
      </div>

      <div className="field">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          autoComplete="new-password"
          id="confirmPassword"
          name="confirmPassword"
          minLength={12}
          required
          type="password"
        />
      </div>

      <p className="support-text">
        Passwords are stored as a hash in PostgreSQL. The `AUTH_PASSWORD` environment variable is only used as the
        first-login bootstrap before the database password exists.
      </p>

      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
