type ErrorMessageProps = {
  error: unknown;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-[#f6465d]/45 bg-[#f6465d]/12 px-3.5 py-3 text-sm text-danger"
    >
      {getErrorMessage(error)}
    </p>
  );
}
