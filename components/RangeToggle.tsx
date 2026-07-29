"use client";

export function RangeToggle({
  value,
  onChange,
}: {
  value: "daily" | "weekly";
  onChange: (v: "daily" | "weekly") => void;
}) {
  return (
    <div
      className="inline-flex rounded-md text-sm overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {(["daily", "weekly"] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="px-3 py-1.5 capitalize transition-colors"
          style={{
            background: value === opt ? "var(--series-1)" : "var(--surface-1)",
            color: value === opt ? "#ffffff" : "var(--text-secondary)",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
