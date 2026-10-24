interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span>
        {" "}
        Page {page} of {totalPages}{" "}
      </span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next
      </button>
    </nav>
  );
}
