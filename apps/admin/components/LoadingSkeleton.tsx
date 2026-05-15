export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-12 animate-pulse rounded-lg bg-gray-800" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="h-32 animate-pulse rounded-lg bg-gray-800" />;
}

export function ChartSkeleton() {
  return <div className="h-80 animate-pulse rounded-lg bg-gray-800" />;
}
