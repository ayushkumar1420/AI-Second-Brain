import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-fern text-white hover:bg-emerald-800",
  secondary: "bg-white text-ink ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800",
  danger: "bg-coral text-white hover:bg-red-700",
  ghost: "text-ink hover:bg-stone-100 dark:text-white dark:hover:bg-zinc-900",
};

export default function Button({ children, variant = "primary", loading = false, className = "", ...props }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
