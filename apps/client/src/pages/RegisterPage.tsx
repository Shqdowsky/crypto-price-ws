import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout, Brand } from "../components/AuthLayout";
import { ErrorMessage } from "../components/ErrorMessage";
import { PasswordInput } from "../components/PasswordInput";
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

	const handleChange =
		(field: keyof RegisterCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
		<AuthLayout>
			<form className="flex w-full max-w-[420px] flex-col gap-5" onSubmit={handleSubmit}>
				<Brand className="mb-2 lg:hidden" />

				<div>
					<h1 className="mb-2 text-[1.75rem] leading-tight font-semibold tracking-tight">
						Create account
					</h1>
					<p className="text-muted">Sign up to start trading with a paper balance.</p>
				</div>

				<div className="flex flex-col gap-[18px]">
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium text-muted" htmlFor="username">
							Username
						</label>
						<input
							id="username"
							className="input"
							name="username"
							type="text"
							autoComplete="username"
							placeholder="satoshi"
							value={credentials.username}
							onChange={handleChange("username")}
							required
						/>
					</div>

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

					<div className="flex flex-col gap-2">
						<PasswordInput
							label="Password"
							value={credentials.password}
							onChange={(password) => setCredentials((prev) => ({ ...prev, password }))}
							autoComplete="new-password"
							required
							minLength={8}
						/>
						<p className="text-[0.8125rem] text-muted">Use at least 8 characters.</p>
					</div>
				</div>

				{registerMutation.isError && <ErrorMessage error={registerMutation.error} />}

				<button type="submit" className="btn w-full" disabled={registerMutation.isPending}>
					{registerMutation.isPending ? "Registering..." : "Register"}
				</button>

				<p className="border-t border-line pt-5 text-center text-muted">
					Already registered?{" "}
					<Link to="/login" className="font-semibold">
						Log in
					</Link>
				</p>
			</form>
		</AuthLayout>
	);
}
