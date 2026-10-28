import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Position } from "@crypto-price-ws/shared";
import { initialSocketState, type SocketState } from "../context/socket/socketReducer";
import { AccountPage } from "./AccountPage";

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
        <AccountPage />
      </MemoryRouter>,
    );
  });
}

function position(token: "btc" | "eth", quantity: string, avgCostBasis: string): Position {
  return {
    id: 1,
    token,
    status: "open",
    quantity,
    avgCostBasis,
    totalBought: "0",
    totalSold: "0",
    avgSellPrice: null,
    realizedPnl: null,
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
  };
}

beforeEach(() => {
  socketState = { ...initialSocketState, balance: "1000" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AccountPage", () => {
  it("shows the estimated total value as USDT balance plus open positions", () => {
    socketState = {
      ...socketState,
      openPositions: { btc: position("btc", "0.5", "50000") },
      prices: { btc: { token: "btc", price: 60000, PDChange: 0, timestamp: 0 } },
    };
    render();

    // 1000 USDT + 0.5 BTC * 60000 = 31000. Digits only, the thousands separator follows the locale.
    const hero = container.querySelector("#overview-heading")?.parentElement;
    expect(hero?.textContent).toMatch(/31\D?000\D00/);
  });

  it("links the Deposit button to the deposit page", () => {
    render();

    const link = Array.from(container.querySelectorAll("a")).find(
      (a) => a.textContent === "Deposit",
    );
    expect(link?.getAttribute("href")).toBe("/account/deposit");
  });

  it("does not render the funding form any more", () => {
    render();

    expect(container.querySelector("#funding-amount")).toBeNull();
  });

  it("always lists USDT as the first asset", () => {
    render();

    const firstRow = container.querySelector("tbody tr");
    expect(firstRow?.textContent).toContain("USDT");
  });

  it("sums all-time realized P&L from closed positions", () => {
    socketState = {
      ...socketState,
      closedPositions: {
        btc: [{ ...position("btc", "0", "0"), status: "closed", realizedPnl: "100.25" }],
        eth: [{ ...position("eth", "0", "0"), status: "closed", realizedPnl: "20.25" }],
      },
    };
    render();

    // Digits and sign only: the decimal separator follows the machine locale.
    expect(container.textContent).toMatch(/\+\$120\D50/);
  });

  it("shows an empty-state hint when there are no open positions", () => {
    render();

    expect(container.textContent).toContain("No open positions yet.");
  });
});
