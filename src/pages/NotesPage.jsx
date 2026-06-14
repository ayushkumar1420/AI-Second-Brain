import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileUp, Plus, StickyNote } from "lucide-react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import KnowledgeCard from "../components/KnowledgeCard";
import NoteForm from "../components/NoteForm";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../hooks/useKnowledge";
import { deleteContent, saveNote, updateNote, updateDocument } from "../services/contentService";
import { saveDocument } from "../services/uploadService";

export default function NotesPage() {
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: notes = [], isError: notesError, error: notesLoadError, isLoading: notesLoading, isFetching: notesFetching } = useContent("note");
  const { data: documents = [], isError: documentsError, error: documentsLoadError, isLoading: documentsLoading, isFetching: documentsFetching } = useContent("document");
  const data = [...notes, ...documents].sort((a, b) => getTime(b) - getTime(a));
  const createMutation = useMutation({
    mutationFn: (payload) => saveNote(user.uid, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["note", user.uid] });
      const previousNotes = queryClient.getQueryData(["note", user.uid]);
      const optimisticNote = {
        id: `pending-note-${Date.now()}`,
        type: "note",
        userId: user.uid,
        title: payload.title,
        content: payload.content,
        summary: "Saving note...",
        tags: payload.tags,
        category: payload.category,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(["note", user.uid], (current = []) => [optimisticNote, ...current]);
      setOpen(false);
      return { previousNotes };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Note saved. AI enrichment is running.");
    },
    onError: (error, payload, context) => {
      void payload;
      queryClient.setQueryData(["note", user.uid], context?.previousNotes || []);
      toast.error(error.message);
    },
  });
  const uploadMutation = useMutation({
    mutationFn: (file) => saveDocument(user.uid, file, setProgress),
    onMutate: async (file) => {
      await queryClient.cancelQueries({ queryKey: ["document", user.uid] });
      const previousDocuments = queryClient.getQueryData(["document", user.uid]);
      const optimisticDocument = {
        id: `pending-document-${Date.now()}`,
        type: "document",
        userId: user.uid,
        fileName: file.name,
        summary: "Uploading PDF...",
        extractedText: "",
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(["document", user.uid], (current = []) => [optimisticDocument, ...current]);
      return { previousDocuments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      setProgress(0);
      toast.success("PDF uploaded. AI enrichment is running.");
    },
    onError: (error, file, context) => {
      void file;
      queryClient.setQueryData(["document", user.uid], context?.previousDocuments || []);
      setProgress(0);
      toast.error(error.message);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (item) => deleteContent(item.type, item.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: [item.type, user.uid] });
      const key = [item.type, user.uid];
      const previousItems = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current = []) => current.filter((entry) => entry.id !== item.id));
      return { key, previousItems };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
    },
    onError: (error, item, context) => {
      void item;
      if (context?.key) queryClient.setQueryData(context.key, context.previousItems || []);
      toast.error(error.message);
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: ({ id, type, originalText, payload }) => {
      if (type === "note") {
        return updateNote(id, payload);
      } else if (type === "document") {
        return updateDocument(id, payload, originalText);
      }
    },
    onMutate: async ({ type, id, payload }) => {
      await queryClient.cancelQueries({ queryKey: [type, user.uid] });
      const previousItems = queryClient.getQueryData([type, user.uid]);
      queryClient.setQueryData([type, user.uid], (current = []) =>
        current.map((item) =>
          item.id === id
            ? { ...item, ...payload, title: payload.title || payload.fileName, summary: "Updating AI summary..." }
            : item
        )
      );
      setEditingItem(null);
      return { previousItems, type };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [context.type, user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Updated successfully. AI enrichment is running.");
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData([context.type, user.uid], context?.previousItems || []);
      toast.error(error.message);
    },
  });
  const isInitialLoading = (notesLoading || documentsLoading) && !data.length;
  const hasLoadError = notesError || documentsError;
  const isRefreshing = (notesFetching || documentsFetching) && data.length;

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
      {editingItem && <NoteForm key={editingItem.id} initialData={editingItem} loading={updateMutation.isPending} onCancel={() => setEditingItem(null)} onSubmit={(payload) => updateMutation.mutate({ id: editingItem.id, type: editingItem.type, originalText: editingItem.extractedText, payload })} />}
      {hasLoadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {notesLoadError?.message || documentsLoadError?.message || "Could not load notes from the database."}
        </div>
      )}
      {isRefreshing && <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Syncing latest changes...</div>}
      {isInitialLoading ? (
        <NotesSkeleton />
      ) : data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((note) => <KnowledgeCard key={`${note.type}-${note.id}`} item={note} onEdit={(item) => setEditingItem(item)} onDelete={(item) => deleteMutation.mutate(item)} />)}
        </div>
      ) : hasLoadError ? (
        <EmptyState icon={StickyNote} title="Could not load your notes" body="The database request failed. Check the error message above, then refresh after fixing Firebase rules or indexes." />
      ) : (
        <EmptyState icon={StickyNote} title="No notes or PDFs yet" body="Capture an idea or upload a PDF and it becomes searchable right away." action="Create note" onAction={() => setOpen(true)} />
      )}
    </>
  );
}

function getTime(item) {
  const value = item.createdAt || item.uploadedAt || item.updatedAt;
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function NotesSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-stone-200 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-2/3 rounded bg-stone-200 dark:bg-zinc-800" />
              <div className="mt-2 h-3 w-20 rounded bg-stone-100 dark:bg-zinc-800" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded bg-stone-100 dark:bg-zinc-800" />
            <div className="h-3 rounded bg-stone-100 dark:bg-zinc-800" />
            <div className="h-3 w-3/4 rounded bg-stone-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
