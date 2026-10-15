import { useState } from "react";
import Button from "./Button";
import { Input, Textarea } from "./Input";

export default function NoteForm({ initialData, onSubmit, onCancel, loading }) {
  const isDocument = initialData?.type === "document";
  const defaultTitle = initialData ? (initialData.title || initialData.fileName) : "";
  const defaultTags = initialData?.tags ? initialData.tags.join(", ") : "";

  const [payload, setPayload] = useState({ 
    title: defaultTitle, 
    category: initialData?.category || "", 
    tags: defaultTags, 
    content: initialData?.content || "" 
  });

  return (
    <form
      className="mb-6 rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(event) => {
        event.preventDefault();
        const submittedTags = payload.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
        if (isDocument) {
          onSubmit({ fileName: payload.title, category: payload.category, tags: submittedTags });
        } else {
          onSubmit({ ...payload, tags: submittedTags });
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={isDocument ? "File Name" : "Title"} value={payload.title} onChange={(event) => setPayload({ ...payload, title: event.target.value })} required />
        <Input label="Category" value={payload.category} onChange={(event) => setPayload({ ...payload, category: event.target.value })} />
      </div>
      <Input className="mt-4" label="Tags" placeholder="firebase, auth, product" value={payload.tags} onChange={(event) => setPayload({ ...payload, tags: event.target.value })} />
      {!isDocument && (
        <Textarea className="mt-4 min-h-52" label="Content" value={payload.content} onChange={(event) => setPayload({ ...payload, content: event.target.value })} required />
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={loading}>{initialData ? "Save changes" : "Save and summarize"}</Button>
      </div>
    </form>
  );
}
