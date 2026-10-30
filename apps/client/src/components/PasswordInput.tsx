import { useId, useState } from "react";

interface Props {
	label: string;
	value: string;
	onChange: (value: string) => void;
	autoComplete: "current-password" | "new-password";
	name?: string;
	required?: boolean;
	minLength?: number;
}

export function PasswordInput({
	label,
	value,
	onChange,
	autoComplete,
	name = "password",
	required,
	minLength,
}: Props) {
	const id = useId();
	const [visible, setVisible] = useState(false);

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium text-muted" htmlFor={id}>
				{label}
			</label>
			<div className="relative flex items-center">
				<input
					id={id}
					className="input pr-12"
					name={name}
					type={visible ? "text" : "password"}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					autoComplete={autoComplete}
					required={required}
					minLength={minLength}
				/>
				<button
					type="button"
					className="absolute right-1 grid size-10 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-white/6 hover:text-fg"
					onClick={() => setVisible((v) => !v)}
					aria-label={visible ? "Hide password" : "Show password"}
					aria-pressed={visible}
				>
					{visible ? (
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
							<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
							<path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
							<line x1="1" y1="1" x2="23" y2="23" />
						</svg>
					) : (
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					)}
				</button>
			</div>
		</div>
	);
}
