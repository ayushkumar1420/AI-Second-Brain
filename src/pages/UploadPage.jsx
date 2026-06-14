import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FilePlus2, UploadCloud } from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../hooks/useKnowledge";
import KnowledgeGrid from "../components/KnowledgeGrid";

export default function UploadPage() {
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data = [], isLoading, isFetching, isError, error } = useContent("document");
  const mutation = useMutation({
    mutationFn: async (file) => {
      const { saveDocument } = await import("../services/uploadService");
      return saveDocument(user.uid, file, setProgress);
    },
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
      toast.success("PDF saved. Text extraction and AI processing are running.");
    },
    onError: (error, file, context) => {
      void file;
      queryClient.setQueryData(["document", user.uid], context?.previousDocuments || []);
      setProgress(0);
      toast.error(error.message);
    },
  });
  const isInitialLoading = isLoading && !data.length;
  const isRefreshing = isFetching && data.length;

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
      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error?.message || "Could not load uploaded documents from the database."}
        </div>
      )}
      {isRefreshing && <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Syncing latest uploads...</div>}
      {isInitialLoading ? (
        <UploadSkeleton />
      ) : data.length ? (
        <KnowledgeGrid data={data} />
      ) : isError ? (
        <EmptyState icon={FilePlus2} title="Could not load documents" body="The database request failed. Check Firebase rules or indexes, then refresh." />
      ) : (
        <EmptyState icon={FilePlus2} title="No documents yet" body="Upload a PDF to extract text and make it available to semantic search and chat." />
      )}
    </>
  );
}

function UploadSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
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
            <div className="h-3 w-4/5 rounded bg-stone-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
