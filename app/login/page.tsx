import { loginAction } from "@/app/actions/auth";
import { isAuthConfigured } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    redirectTo?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid: "The email or password did not match the configured owner account.",
  "missing-config": "Set AUTH_EMAIL, AUTH_PASSWORD, and SESSION_SECRET before signing in.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;
  const redirectTo = params.redirectTo ?? "/";

  return (
    <div className="login-shell">
      <div className="login-panel">
        <p className="eyebrow">LifeOpsPortal</p>
        <h1>Sign in to the operational home base.</h1>
        <p className="support-text">
          The first release is single-owner and optimized for direct execution, project visibility, and durable
          knowledge.
        </p>

        {!isAuthConfigured() ? (
          <div className="error-banner">{errorMessages["missing-config"]}</div>
        ) : null}

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

        <form action={loginAction} className="login-form">
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input autoComplete="email" id="email" name="email" placeholder="devon.watkins@gmail.com" required type="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input autoComplete="current-password" id="password" name="password" required type="password" />
          </div>
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

