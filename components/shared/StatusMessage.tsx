interface StatusMessageProps {
  message?: string;
  error?: string;
}

export function StatusMessage({ message, error }: StatusMessageProps) {
  if (!message && !error) return null;

  if (error) {
    return (
      <div className="mb-4 p-4 bg-red-50 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg">
      <p className="text-blue-800">{message}</p>
    </div>
  );
}
