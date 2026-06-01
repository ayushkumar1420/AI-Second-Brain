import { forwardRef } from "react";

export const Input = forwardRef(function Input({ label, error, className = "", ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-ink dark:text-zinc-100">{label}</span>}
      <input
        ref={ref}
        className={`w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-stone-400 focus:border-fern focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:ring-emerald-950 ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-sm text-coral">{error}</span>}
    </label>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, className = "", ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-ink dark:text-zinc-100">{label}</span>}
      <textarea
        ref={ref}
        className={`w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-stone-400 focus:border-fern focus:ring-4 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:ring-emerald-950 ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-sm text-coral">{error}</span>}
    </label>
  );
});
