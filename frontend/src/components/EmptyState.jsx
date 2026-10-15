import Button from "./Button";

export default function EmptyState({ icon: Icon, title, body, action, onAction }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        {Icon && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-fern dark:bg-emerald-950">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <h2 className="text-lg font-bold text-ink dark:text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500 dark:text-zinc-400">{body}</p>
        {action && (
          <Button className="mt-5" onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </div>
  );
}
