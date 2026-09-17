import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import type { RegisterCredentials } from "../types/auth";
import { useRegisterMutation } from "../hooks/authQueries";

const initialCredentials: RegisterCredentials = {
  username: "",
  email: "",
  password: "",
};

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();
  const [credentials, setCredentials] = useState<RegisterCredentials>(initialCredentials);

  const handleChange = (field: keyof RegisterCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await registerMutation.mutateAsync(credentials);
      navigate("/", { replace: true });
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={credentials.username}
          onChange={handleChange("username")}
          required
        />
      </div>

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
          autoComplete="new-password"
          value={credentials.password}
          onChange={handleChange("password")}
          required
          minLength={8}
        />
      </div>

      {registerMutation.isError && <ErrorMessage error={registerMutation.error} />}

      <button type="submit" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? "Registering..." : "Register"}
      </button>

      <p>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}