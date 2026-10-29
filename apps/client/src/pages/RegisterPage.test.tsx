import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./RegisterPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render() {
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	act(() => {
		root.render(
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={["/register"]}>
					<Routes>
						<Route path="/register" element={<RegisterPage />} />
						<Route path="/" element={<p>home</p>} />
					</Routes>
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

async function submitRegister() {
	setValue(container.querySelector<HTMLInputElement>("#username")!, "satoshi");
	setValue(container.querySelector<HTMLInputElement>("#email")!, "user@example.com");
	setValue(container.querySelector<HTMLInputElement>('input[name="password"]')!, "secret123");
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

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("RegisterPage", () => {
	it("renders the form, brand and a link to login", () => {
		render();

		expect(container.querySelector("h1")?.textContent).toBe("Create account");
		expect(container.querySelector("#username")).not.toBeNull();
		expect(container.querySelector("#email")).not.toBeNull();
		expect(container.textContent).toContain("crypto-price-ws");
		expect(container.querySelector('a[href="/login"]')).not.toBeNull();
	});

	it("requires a password of at least 8 characters", () => {
		render();
		const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;

		expect(password.required).toBe(true);
		expect(password.minLength).toBe(8);
		expect(password.autocomplete).toBe("new-password");
	});

	it("shows the server error when registration fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 409,
				json: () => Promise.resolve({ message: "Email already registered" }),
			}),
		);
		render();

		await submitRegister();

		expect(container.querySelector('[role="alert"]')?.textContent).toBe("Email already registered");
	});

	it("navigates home after a successful registration", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) }),
		);
		render();

		await submitRegister();

		expect(container.textContent).toBe("home");
	});
});
