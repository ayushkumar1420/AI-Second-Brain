export default function StatCard({ icon: Icon, label, value, tone = "bg-emerald-100 text-fern" }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-ink dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
