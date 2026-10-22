import type { LoginCredentials } from "../types/auth";
import { useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoginError, useLoginMutation } from "../hooks/authQueries";
import { formatCountdown, useCountdown } from "../hooks/useCountdown";
import { PasswordInput } from "../components/PasswordInput";

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
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
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

      {locked && (
        <p role="alert">Too many failed attempts. Try again in {formatCountdown(secondsLeft)}.</p>
      )}
      {error &&
        !isLockError &&
        (error instanceof LoginError && error.attemptsLeft !== undefined ? (
          <p role="alert">
            {error.message}. {error.attemptsLeft}{" "}
            {error.attemptsLeft === 1 ? "attempt" : "attempts"} left.
          </p>
        ) : (
          <ErrorMessage error={error} />
        ))}

      <button type="submit" disabled={loginMutation.isPending || locked}>
        {loginMutation.isPending ? "Logging in..." : locked ? "Locked" : "Log in"}
      </button>
    </form>
  );
}
