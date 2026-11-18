import { useEffect, useState } from "react";

import { cx } from "#app/utils/format";

type Toast = { id: number; tone: "success" | "error"; text: string };

let next = 1;
const listeners = new Set<(t: Toast) => void>();

/** Aviso curto, de qualquer lugar. O Toaster montado no App mostra. */
export const toast = {
  success: (text: string) => listeners.forEach((l) => l({ id: next++, tone: "success", text })),
  error: (text: string) => listeners.forEach((l) => l({ id: next++, tone: "error", text })),
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4500);
    };
    listeners.add(add);
    return () => void listeners.delete(add);
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cx(
            "pointer-events-auto max-w-md rounded-field px-4 py-3 text-sm font-semibold shadow-card",
            t.tone === "success" ? "bg-field-green-deep text-white" : "bg-danger text-white",
          )}
        >
          {t.tone === "success" ? "✓ " : "! "}
          {t.text}
        </div>
      ))}
    </div>
  );
}
