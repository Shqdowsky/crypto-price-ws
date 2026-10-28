interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const BUTTON =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 text-sm font-medium text-fg transition-all duration-150 ease-out enabled:hover:-translate-y-px enabled:hover:border-primary/60 enabled:hover:bg-primary/16 enabled:hover:text-link enabled:hover:shadow-md enabled:active:translate-y-0 enabled:active:scale-95 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

function ChevronLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="transition-transform duration-150 group-enabled:group-hover:-translate-x-0.5"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="transition-transform duration-150 group-enabled:group-hover:translate-x-0.5"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`group ${BUTTON}`}
      >
        <ChevronLeft />
        Previous
      </button>
      <span className="text-sm text-muted tabular-nums">
        Page <span className="font-semibold text-fg">{page}</span> of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`group ${BUTTON}`}
      >
        Next
        <ChevronRight />
      </button>
    </nav>
  );
}
