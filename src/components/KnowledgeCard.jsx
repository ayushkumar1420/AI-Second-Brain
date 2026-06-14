import { Edit2, FileText, Link as LinkIcon, StickyNote, Trash2 } from "lucide-react";
import Button from "./Button";

const icons = {
  note: StickyNote,
  document: FileText,
  link: LinkIcon,
};

export default function KnowledgeCard({ item, onEdit, onDelete }) {
  const Icon = icons[item.type] || StickyNote;
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gold/20 text-yellow-700">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-ink dark:text-white">{item.title || item.fileName || item.url}</h3>
            <p className="text-xs uppercase tracking-wide text-stone-400">{item.type}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {onEdit && (
            <Button variant="ghost" className="h-9 w-9 px-0 text-stone-400 hover:text-ink dark:text-zinc-500 dark:hover:text-zinc-300" onClick={() => onEdit(item)} title="Edit">
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" className="h-9 w-9 px-0 text-stone-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-500" onClick={() => onDelete(item)} title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap text-sm text-stone-600 dark:text-zinc-300">{item.summary || item.content || item.extractedText}</p>
      {Boolean(item.tags?.length) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
