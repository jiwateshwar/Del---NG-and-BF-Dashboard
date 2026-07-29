"use client";

import { useRef, useState } from "react";
import { uploadWorkbook, type UploadResponse } from "@/lib/client/api";

export function UploadWidget({
  slug,
  onUploaded,
}: {
  slug: string;
  onUploaded: (result: UploadResponse) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadWorkbook(slug, file);
      setResult(res);
      onUploaded(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg px-4 py-3 text-sm cursor-pointer flex items-center justify-between gap-4"
        style={{
          border: `1px dashed ${dragging ? "var(--series-1)" : "var(--baseline)"}`,
          background: "var(--surface-1)",
          color: "var(--text-secondary)",
        }}
      >
        <span>
          {busy
            ? "Parsing workbook…"
            : "Drop the latest MIS .xlsx here, or click to choose a file"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Parsed {result.metricPointCount} data points, {result.kpiRowCount} KPI rows, as of{" "}
          {result.asOfDate ?? "unknown date"}.
          {result.warnings.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer" style={{ color: "var(--danger)" }}>
                {result.warnings.length} warning(s)
              </summary>
              <ul className="list-disc pl-5 mt-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
