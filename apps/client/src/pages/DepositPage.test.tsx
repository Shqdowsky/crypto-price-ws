import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FundingRequest } from "@crypto-price-ws/shared";
import { DepositPage } from "./DepositPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  requests: { data: undefined as unknown, error: null as Error | null, isPending: false },
  create: { mutate: vi.fn(), isPending: false, error: null as Error | null },
  cancel: { mutate: vi.fn(), isPending: false, error: null as Error | null },
}));

vi.mock("../hooks/fundingQueries", () => ({
  useMyFundingRequests: () => mocks.requests,
  useCreateFundingRequest: () => mocks.create,
  useCancelFundingRequest: () => mocks.cancel,
}));

let container: HTMLDivElement;
let root: Root;

function request(overrides: Partial<FundingRequest>): FundingRequest {
  return {
    id: 1,
    amount: "2000",
    status: "approved",
    reason: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    reviewedAt: null,
    ...overrides,
  };
}

function render() {
  act(() => {
    root.render(
      <MemoryRouter>
        <DepositPage />
      </MemoryRouter>,
    );
  });
}

/** Sets a controlled input's value the way a user typing would, so React's onChange fires. */
function typeIntoInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submitForm() {
  const form = container.querySelector("form");
  act(() => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  mocks.requests = { data: [], error: null, isPending: false };
  mocks.create = { mutate: vi.fn(), isPending: false, error: null };
  mocks.cancel = { mutate: vi.fn(), isPending: false, error: null };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("DepositPage", () => {
  it("links back to the account overview", () => {
    render();

    const back = container.querySelector<HTMLAnchorElement>('a[href="/account"]');
    expect(back).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Deposit");
  });

  it("shows an empty state when there are no requests", () => {
    render();

    expect(container.textContent).toContain("No deposit requests yet.");
  });

  it("lists every request with its status and Cancel only for pending ones", () => {
    mocks.requests.data = [
      request({ id: 1, status: "pending", amount: "1000" }),
      request({ id: 2, status: "rejected", amount: "3000", reason: "Over limit" }),
    ];
    render();

    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Pending");
    expect(rows[0].querySelector("button")?.textContent).toBe("Cancel request");
    expect(rows[1].textContent).toContain("Rejected");
    expect(rows[1].textContent).toContain("Over limit");
    expect(rows[1].querySelector("button")).toBeNull();
  });

  it("cancels a pending request", () => {
    mocks.requests.data = [request({ id: 7, status: "pending" })];
    render();

    const button = container.querySelector("tbody button") as HTMLButtonElement;
    act(() => button.click());

    expect(mocks.cancel.mutate).toHaveBeenCalledWith(7);
  });

  it("disables the form and shows a notice while a request is waiting", () => {
    mocks.requests.data = [request({ status: "pending" })];
    render();

    const input = container.querySelector<HTMLInputElement>("#funding-amount");
    expect(input?.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("waiting for review");
    // Regression: the notice used to print the boolean "true".
    expect(container.textContent).not.toContain("true");
  });

  it("rejects an amount outside the allowed range without sending it", () => {
    render();

    typeIntoInput(container.querySelector("#funding-amount") as HTMLInputElement, "500");
    submitForm();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Enter a whole amount",
    );
    expect(mocks.create.mutate).not.toHaveBeenCalled();
  });

  it("sends a valid whole amount", () => {
    render();

    typeIntoInput(container.querySelector("#funding-amount") as HTMLInputElement, "2000");
    submitForm();

    expect(mocks.create.mutate).toHaveBeenCalledWith(2000, expect.any(Object));
  });
});
