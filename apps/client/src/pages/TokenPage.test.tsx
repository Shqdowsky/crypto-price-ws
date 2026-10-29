import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialSocketState, type SocketState } from "../context/socket/socketReducer";
import { TokenPage } from "./TokenPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ctx = vi.hoisted(() => ({
	state: null as unknown as SocketState,
	getPositionHistory: vi.fn(),
	getTradeHistory: vi.fn(),
	trade: vi.fn(),
}));

vi.mock("../context/socket/SocketProvider", () => ({
	useSocketContext: () => ctx,
}));

let container: HTMLDivElement;
let root: Root;

function render(path: string) {
	act(() => {
		root.render(
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/" element={<div>home page</div>} />
					<Route path="/token/:tokenName" element={<TokenPage />} />
				</Routes>
			</MemoryRouter>,
		);
	});
}

beforeEach(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	ctx.state = { ...initialSocketState };
	ctx.getPositionHistory.mockClear();
	ctx.getTradeHistory.mockClear();
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.unstubAllGlobals();
});

describe("TokenPage", () => {
	it("loads position and trade history once for a valid token", () => {
		render("/token/sol");

		expect(ctx.getPositionHistory).toHaveBeenCalledTimes(1);
		expect(ctx.getPositionHistory).toHaveBeenCalledWith("sol");
		expect(ctx.getTradeHistory).toHaveBeenCalledWith("sol");
	});

	it("redirects an unknown token to the dashboard without loading history", () => {
		render("/token/nope");

		expect(container.textContent).toContain("home page");
		expect(ctx.getPositionHistory).not.toHaveBeenCalled();
	});
});
