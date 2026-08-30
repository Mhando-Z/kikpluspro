"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({ reset }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="surface-panel max-w-md p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-bold">The feed lost possession</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          The last synchronized data is still safe. Retry this page while the
          upstream connection recovers.
        </p>
        <button className="button-primary mt-6" onClick={reset} type="button">
          <RotateCcw className="size-4" /> Retry page
        </button>
      </div>
    </div>
  );
}
