import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FilePlus2, UploadCloud } from "lucide-react";
import EmptyState from "../components/EmptyState";
import KnowledgeCard from "../components/KnowledgeCard";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../hooks/useKnowledge";
import { saveDocument } from "../services/uploadService";
import { deleteContent, updateDocument } from "../services/contentService";
import NoteForm from "../components/NoteForm";

export default function UploadPage() {
  const [progress, setProgress] = useState(0);
  const [editingItem, setEditingItem] = useState(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data = [] } = useContent("document");
  const mutation = useMutation({
    mutationFn: (file) => saveDocument(user.uid, file, setProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      setProgress(0);
      toast.success("PDF saved. Text extraction and AI processing are running.");
    },
    onError: (error) => {
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
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
    },
    onError: (error, item, context) => {
      if (context?.key) queryClient.setQueryData(context.key, context.previousItems || []);
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload, originalText }) => updateDocument(id, payload, originalText),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["document", user.uid] });
      const previousItems = queryClient.getQueryData(["document", user.uid]);
      queryClient.setQueryData(["document", user.uid], (current = []) =>
        current.map((item) =>
          item.id === id
            ? { ...item, ...payload, fileName: payload.fileName, summary: "Updating AI summary..." }
            : item
        )
      );
      setEditingItem(null);
      return { previousItems };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Updated successfully. AI enrichment is running.");
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(["document", user.uid], context?.previousItems || []);
      toast.error(error.message);
    },
  });

  return (
    <>
      <PageHeader title="Upload" description="Drop in PDFs and turn them into searchable AI context." />
      <label className="mb-6 grid cursor-pointer place-items-center rounded-lg border-2 border-dashed border-stone-300 bg-white p-10 text-center transition hover:border-fern dark:border-zinc-800 dark:bg-zinc-900">
        <UploadCloud className="mb-3 h-10 w-10 text-fern" />
        <span className="font-bold text-ink dark:text-white">Upload PDF</span>
        <span className="mt-1 text-sm text-stone-500">The file is saved first. Text extraction, summary, and embedding continue after upload.</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={mutation.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) mutation.mutate(file);
            event.target.value = "";
          }}
        />
        {mutation.isPending && <div className="mt-4 h-2 w-full max-w-md rounded-full bg-stone-100"><div className="h-2 rounded-full bg-fern" style={{ width: `${progress}%` }} /></div>}
      </label>
      {editingItem && <NoteForm key={editingItem.id} initialData={editingItem} loading={updateMutation.isPending} onCancel={() => setEditingItem(null)} onSubmit={(payload) => updateMutation.mutate({ id: editingItem.id, payload, originalText: editingItem.extractedText })} />}
      {data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((item) => <KnowledgeCard key={item.id} item={item} onEdit={(item) => setEditingItem(item)} onDelete={(item) => deleteMutation.mutate(item)} />)}</div>
      ) : (
        <EmptyState icon={FilePlus2} title="No documents yet" body="Upload a PDF to extract text and make it available to semantic search and chat." />
      )}
    </>
  );
}
