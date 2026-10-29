import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render() {
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	act(() => {
		root.render(
			<QueryClientProvider client={queryClient}>
				<MemoryRouter>
					<LoginPage />
				</MemoryRouter>
			</QueryClientProvider>,
		);
	});
}

function setValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	act(() => {
		setter?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function submitLogin() {
	const email = container.querySelector<HTMLInputElement>("#email")!;
	const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;
	setValue(email, "user@example.com");
	setValue(password, "secret123");
	await act(async () => {
		container
			.querySelector("form")!
			.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	});
	// React Query notifies observers on a macrotask; let it flush into React.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

function mockLoginFailure(status: number, body: Record<string, unknown>) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve(body) }),
	);
}

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.unstubAllGlobals();
});

describe("LoginPage", () => {
	it("renders the form, brand and a link to registration", () => {
		render();

		expect(container.querySelector("h1")?.textContent).toBe("Log in");
		expect(container.querySelector("#email")).not.toBeNull();
		expect(container.querySelector('input[name="password"]')).not.toBeNull();
		expect(container.textContent).toContain("crypto-price-ws");
		expect(container.querySelector('a[href="/register"]')).not.toBeNull();
	});

	it("toggles password visibility", () => {
		render();
		const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;
		const toggle = container.querySelector<HTMLButtonElement>("button[aria-pressed]")!;

		expect(password.type).toBe("password");
		act(() => toggle.click());
		expect(password.type).toBe("text");
		expect(toggle.getAttribute("aria-label")).toBe("Hide password");
	});

	it("shows the remaining attempts after a failed login", async () => {
		mockLoginFailure(401, { message: "Invalid credentials", attemptsLeft: 1 });
		render();

		await submitLogin();

		const alert = container.querySelector('[role="alert"]');
		expect(alert?.textContent).toContain("Invalid credentials. 1 attempt left.");
		expect(alert?.className).toContain("text-danger");
	});

	it("locks the form with a countdown after too many attempts", async () => {
		mockLoginFailure(429, { message: "Too many attempts", retryAfterSeconds: 90 });
		render();

		await submitLogin();

		const alert = container.querySelector('[role="alert"]');
		expect(alert?.textContent).toContain("Try again in 1:30");
		const button = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
		expect(button.disabled).toBe(true);
		expect(button.textContent).toBe("Locked");
	});
});
