import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialSocketState, type SocketState } from "../context/socket/socketReducer";
import { Dashboard } from "./Dashboard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let socketState: SocketState = initialSocketState;

vi.mock("../context/socket/SocketProvider", () => ({
	useSocketContext: () => ({ state: socketState }),
}));

let container: HTMLDivElement;
let root: Root;

function render() {
	act(() => {
		root.render(
			<MemoryRouter>
				<Dashboard />
			</MemoryRouter>,
		);
	});
}

const tick = (token: "btc" | "eth", price: number, PDChange: number) => ({
	token,
	price,
	PDChange,
	timestamp: 0,
});
const history = (...prices: number[]) => prices.map((price, i) => ({ price, timestamp: i }));

function rowFor(symbol: string): HTMLTableRowElement {
	const row = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
		tr.textContent?.includes(symbol),
	);
	if (!row) throw new Error(`No row for ${symbol}`);
	return row as HTMLTableRowElement;
}

beforeEach(() => {
	socketState = { ...initialSocketState };
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe("Dashboard", () => {
	it("lists every market as a row linking to its token page", () => {
		render();

		const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("tbody a")).map((a) =>
			a.getAttribute("href"),
		);
		expect(links).toEqual(expect.arrayContaining(["/token/btc", "/token/eth", "/token/sol"]));
		expect(container.querySelector("h1")?.textContent).toBe("Cryptocurrency prices");
	});

	it("shows price and the 24h change from PDChange", () => {
		socketState = {
			...initialSocketState,
			prices: { btc: tick("btc", 66000, 2.5) },
			priceHistory: { btc: history(60000, 63000, 66000) },
		};
		render();

		const row = rowFor("Bitcoin");
		expect(row.textContent).toContain("$66,000.00");
		expect(row.textContent).toContain("+2.50%");
		expect(row.querySelector(".text-up")).not.toBeNull();
		expect(row.querySelector("svg polyline")).not.toBeNull();
	});

	it("ignores the in-page history when computing the change", () => {
		socketState = {
			...initialSocketState,
			prices: { btc: tick("btc", 66000, -1.2) },
			priceHistory: { btc: history(60000, 63000, 66000) },
		};
		render();

		const row = rowFor("Bitcoin");
		expect(row.textContent).toContain("-1.20%");
		expect(row.textContent).not.toContain("+10.00%");
	});

	it("colors a falling token red", () => {
		socketState = {
			...initialSocketState,
			prices: { eth: tick("eth", 1500, -25) },
			priceHistory: { eth: history(2000, 1500) },
		};
		render();

		const row = rowFor("Ethereum");
		expect(row.textContent).toContain("-25.00%");
		expect(row.querySelector(".text-down")).not.toBeNull();
	});

	it("shows loading skeletons and a dash while a price is missing", () => {
		render();

		const row = rowFor("Bitcoin");
		expect(row.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
		expect(row.textContent).not.toContain("$");
		expect(row.textContent).toContain("—");
	});

	it("shows a Trade button on every row, including mobile widths", () => {
		render();

		const rows = Array.from(container.querySelectorAll("tbody tr"));
		expect(rows).toHaveLength(6);
		for (const row of rows) {
			const trade = Array.from(row.querySelectorAll("span")).find((s) => s.textContent === "Trade");
			expect(trade).toBeDefined();
			// Visible on mobile: no max-sm:hidden class on the cell or the button.
			expect(trade?.closest("td")?.className).not.toContain("max-sm:hidden");
		}
	});

	it("shows the connection status and balance", () => {
		socketState = { ...initialSocketState, connectionStatus: "connected", balance: "1234.5" };
		render();

		expect(container.querySelector('[role="status"]')?.textContent).toBe("Live");
		// formatUsd follows the machine locale, so only check digits and decimals.
		expect(container.textContent).toMatch(/\$1\D?234\D50/);
	});

	it("shows the last socket error", () => {
		socketState = {
			...initialSocketState,
			lastError: { code: "X", message: "Something broke" } as SocketState["lastError"],
		};
		render();

		expect(container.querySelector('[role="alert"]')?.textContent).toBe("Something broke");
	});
});
