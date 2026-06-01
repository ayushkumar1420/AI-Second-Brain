import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link as LinkIcon, Plus } from "lucide-react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import KnowledgeCard from "../components/KnowledgeCard";
import { Input, Textarea } from "../components/Input";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../hooks/useKnowledge";
import { createLink } from "../services/contentService";

export default function LinksPage() {
  const [payload, setPayload] = useState({ url: "", title: "", content: "", tags: "" });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data = [] } = useContent("link");
  const mutation = useMutation({
    mutationFn: () => createLink(user.uid, { ...payload, tags: payload.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
    onSuccess: () => {
      setPayload({ url: "", title: "", content: "", tags: "" });
      queryClient.invalidateQueries({ queryKey: ["link", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Link saved and embedded.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Links" description="Save URLs with optional article text for summaries and retrieval." />
      <form className="mb-6 rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="URL" type="url" value={payload.url} onChange={(event) => setPayload({ ...payload, url: event.target.value })} required />
          <Input label="Title" value={payload.title} onChange={(event) => setPayload({ ...payload, title: event.target.value })} />
        </div>
        <Input className="mt-4" label="Tags" value={payload.tags} onChange={(event) => setPayload({ ...payload, tags: event.target.value })} />
        <Textarea className="mt-4 min-h-32" label="Article text" value={payload.content} onChange={(event) => setPayload({ ...payload, content: event.target.value })} placeholder="Paste article content for better summaries and answers." />
        <div className="mt-4 flex justify-end">
          <Button loading={mutation.isPending}><Plus className="h-4 w-4" /> Save link</Button>
        </div>
      </form>
      {data.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((item) => <KnowledgeCard key={item.id} item={item} />)}</div>
      ) : (
        <EmptyState icon={LinkIcon} title="No links yet" body="Add an article, docs page, or useful reference and Gemini will summarize it." />
      )}
    </>
  );
}
