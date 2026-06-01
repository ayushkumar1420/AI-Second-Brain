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

export default function UploadPage() {
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data = [] } = useContent("document");
  const mutation = useMutation({
    mutationFn: (file) => saveDocument(user.uid, file, setProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      setProgress(0);
      toast.success("PDF uploaded, extracted, and summarized.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Upload" description="Drop in PDFs and turn them into searchable AI context." />
      <label className="mb-6 grid cursor-pointer place-items-center rounded-lg border-2 border-dashed border-stone-300 bg-white p-10 text-center transition hover:border-fern dark:border-zinc-800 dark:bg-zinc-900">
        <UploadCloud className="mb-3 h-10 w-10 text-fern" />
        <span className="font-bold text-ink dark:text-white">Upload PDF</span>
        <span className="mt-1 text-sm text-stone-500">Text extraction, storage upload, summary, and embedding run after selection.</span>
        <input type="file" accept="application/pdf" className="hidden" onChange={(event) => event.target.files?.[0] && mutation.mutate(event.target.files[0])} />
        {mutation.isPending && <div className="mt-4 h-2 w-full max-w-md rounded-full bg-stone-100"><div className="h-2 rounded-full bg-fern" style={{ width: `${progress}%` }} /></div>}
      </label>
      {data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((item) => <KnowledgeCard key={item.id} item={item} />)}</div>
      ) : (
        <EmptyState icon={FilePlus2} title="No documents yet" body="Upload a PDF to extract text and make it available to semantic search and chat." />
      )}
    </>
  );
}
