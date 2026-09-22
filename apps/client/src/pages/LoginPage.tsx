import { useLocation, useNavigate } from "react-router";
import type { LoginCredentials } from "../types/auth";
import { useEffect, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoginMutation } from "../hooks/authQueries";
import { useAuthContext } from "../context/auth/AuthContext";

const initialCredentials: LoginCredentials = {
  email: "",
  password: "",
};

export function LoginPage() {
  const loginMutation = useLoginMutation();
  const [credentials, setCredentials] = useState<LoginCredentials>(initialCredentials);

  const handleChange = (field: keyof LoginCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await loginMutation.mutateAsync(credentials);
    } catch (err) {
      console.log(err);
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

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={credentials.password}
          onChange={handleChange("password")}
          required
        />
      </div>

      {loginMutation.isError && <ErrorMessage error={loginMutation.error} />}

      <button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}