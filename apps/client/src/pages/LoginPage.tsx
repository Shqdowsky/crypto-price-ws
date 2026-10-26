import type { LoginCredentials } from "../types/auth";
import { useState } from "react";
import { Link } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoginError, useLoginMutation } from "../hooks/authQueries";
import { formatCountdown, useCountdown } from "../hooks/useCountdown";
import { PasswordInput } from "../components/PasswordInput";
import { AuthLayout, Brand } from "../components/AuthLayout";

const initialCredentials: LoginCredentials = {
  email: "",
  password: "",
};

export function LoginPage() {
  const loginMutation = useLoginMutation();
  const [credentials, setCredentials] = useState<LoginCredentials>(initialCredentials);
  const { secondsLeft, start } = useCountdown();
  const locked = secondsLeft > 0;
  const error = loginMutation.error;
  const isLockError = error instanceof LoginError && error.retryAfterSeconds !== undefined;

  const handleChange =
    (field: keyof LoginCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await loginMutation.mutateAsync(credentials);
    } catch (err) {
      if (err instanceof LoginError && err.retryAfterSeconds !== undefined) {
        start(err.retryAfterSeconds);
      }
    }
  };

  return (
    <AuthLayout>
      <form className="flex w-full max-w-[420px] flex-col gap-5" onSubmit={handleSubmit}>
        <Brand className="mb-2 lg:hidden" />

        <div>
          <h1 className="mb-2 text-[1.75rem] leading-tight font-semibold tracking-tight">Log in</h1>
          <p className="text-muted">Welcome back. Enter your details to continue.</p>
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={credentials.email}
              onChange={handleChange("email")}
              required
            />
          </div>

          <PasswordInput
            label="Password"
            value={credentials.password}
            onChange={(password) => setCredentials((prev) => ({ ...prev, password }))}
            autoComplete="current-password"
            required
          />
        </div>

        {locked && (
          <p
            role="alert"
            className="rounded-[10px] border border-link/45 bg-primary/14 px-3.5 py-3 text-sm"
          >
            Too many failed attempts. Try again in {formatCountdown(secondsLeft)}.
          </p>
        )}
        {error &&
          !isLockError &&
          (error instanceof LoginError && error.attemptsLeft !== undefined ? (
            <p
              role="alert"
              className="rounded-[10px] border border-[#f6465d]/45 bg-[#f6465d]/12 px-3.5 py-3 text-sm text-danger"
            >
              {error.message}. {error.attemptsLeft}{" "}
              {error.attemptsLeft === 1 ? "attempt" : "attempts"} left.
            </p>
          ) : (
            <ErrorMessage error={error} />
          ))}

        <button type="submit" className="btn w-full" disabled={loginMutation.isPending || locked}>
          {loginMutation.isPending ? "Logging in..." : locked ? "Locked" : "Log in"}
        </button>

        <p className="border-t border-line pt-5 text-center text-muted">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-semibold">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
