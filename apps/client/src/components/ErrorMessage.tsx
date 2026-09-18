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
    <p role="alert" style={{ color: "crimson" }}>
      {getErrorMessage(error)}
    </p>
  );
}