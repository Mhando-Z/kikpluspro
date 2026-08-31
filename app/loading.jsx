export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading page">
      <div className="h-28 animate-pulse rounded-4xl bg-surface-soft" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-32 animate-pulse rounded-3xl bg-surface-soft"
            key={index}
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-4xl bg-surface-soft" />
    </div>
  );
}
