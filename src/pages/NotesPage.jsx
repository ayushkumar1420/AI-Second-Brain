import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileUp, Plus, StickyNote } from "lucide-react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import KnowledgeCard from "../components/KnowledgeCard";
import { Input, Textarea } from "../components/Input";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../hooks/useKnowledge";
import { deleteContent, saveNote } from "../services/contentService";
import { saveDocument } from "../services/uploadService";

export default function NotesPage() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: notes = [], isLoading: notesLoading } = useContent("note");
  const { data: documents = [], isLoading: documentsLoading } = useContent("document");
  const data = [...notes, ...documents].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const createMutation = useMutation({
    mutationFn: (payload) => saveNote(user.uid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      setOpen(false);
      toast.success("Note saved. AI enrichment is running.");
    },
    onError: (error) => toast.error(error.message),
  });
  const uploadMutation = useMutation({
    mutationFn: (file) => saveDocument(user.uid, file, setProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      setProgress(0);
      toast.success("PDF uploaded. AI enrichment is running.");
    },
    onError: (error) => {
      setProgress(0);
      toast.error(error.message);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (item) => deleteContent(item.type, item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
    },
  });
  const isLoading = notesLoading || documentsLoading;

  return (
    <>
      <PageHeader title="Notes" description="Create notes or upload PDFs with fast searchable AI context.">
        <label className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-ink ring-1 ring-stone-200 transition hover:bg-stone-50 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800 ${uploadMutation.isPending ? "pointer-events-none opacity-60" : ""}`}>
          <FileUp className="h-4 w-4" />
          {uploadMutation.isPending ? `Uploading ${progress}%` : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploadMutation.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              event.target.value = "";
            }}
          />
        </label>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New note</Button>
      </PageHeader>
      {open && <NoteForm loading={createMutation.isPending} onCancel={() => setOpen(false)} onSubmit={(payload) => createMutation.mutate(payload)} />}
      {isLoading ? (
        <div className="text-sm text-stone-500">Loading notes...</div>
      ) : data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((note) => <KnowledgeCard key={note.id} item={note} onDelete={(item) => deleteMutation.mutate(item)} />)}
        </div>
      ) : (
        <EmptyState icon={StickyNote} title="No notes or PDFs yet" body="Capture an idea or upload a PDF and it becomes searchable right away." action="Create note" onAction={() => setOpen(true)} />
      )}
    </>
  );
}

function NoteForm({ onSubmit, onCancel, loading }) {
  const [payload, setPayload] = useState({ title: "", category: "", tags: "", content: "" });
  return (
    <form
      className="mb-6 rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...payload, tags: payload.tags.split(",").map((tag) => tag.trim()).filter(Boolean) });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" value={payload.title} onChange={(event) => setPayload({ ...payload, title: event.target.value })} required />
        <Input label="Category" value={payload.category} onChange={(event) => setPayload({ ...payload, category: event.target.value })} />
      </div>
      <Input className="mt-4" label="Tags" placeholder="firebase, auth, product" value={payload.tags} onChange={(event) => setPayload({ ...payload, tags: event.target.value })} />
      <Textarea className="mt-4 min-h-52" label="Content" value={payload.content} onChange={(event) => setPayload({ ...payload, content: event.target.value })} required />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={loading}>Save and summarize</Button>
      </div>
    </form>
  );
}
