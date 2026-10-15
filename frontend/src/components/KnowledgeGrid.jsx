import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";
import KnowledgeCard from "./KnowledgeCard";
import NoteForm from "./NoteForm";
import { deleteContent, updateNote, updateDocument } from "../services/contentService";
import { useAuth } from "../context/AuthContext";

export default function KnowledgeGrid({ data }) {
  const [editingItem, setEditingItem] = useState(null);
  const [confirmingItem, setConfirmingItem] = useState(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateCaches = (type, updater) => {
    queryClient.setQueryData([type, user.uid], (current = []) => updater(current));
    queryClient.setQueryData(["knowledge", user.uid], (current = []) => updater(current));
  };

  const deleteMutation = useMutation({
    mutationFn: (item) => deleteContent(item.type, item.id),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: [item.type, user.uid] });
      await queryClient.cancelQueries({ queryKey: ["knowledge", user.uid] });
      const previousItems = queryClient.getQueryData([item.type, user.uid]);
      const previousKnowledge = queryClient.getQueryData(["knowledge", user.uid]);
      updateCaches(item.type, (current) => current.filter((entry) => entry.id !== item.id));
      setConfirmingItem(null);
      return { previousItems, previousKnowledge, type: item.type };
    },
    onSuccess: (result, item) => {
      void result;
      queryClient.invalidateQueries({ queryKey: [item.type, user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Deleted successfully.");
    },
    onError: (error, item, context) => {
      void item;
      if (context?.type) queryClient.setQueryData([context.type, user.uid], context.previousItems || []);
      queryClient.setQueryData(["knowledge", user.uid], context?.previousKnowledge || []);
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, type, originalText, payload }) => {
      if (type === "note") return updateNote(id, payload);
      if (type === "document") return updateDocument(id, payload, originalText);
    },
    onMutate: async ({ id, type, payload }) => {
      await queryClient.cancelQueries({ queryKey: [type, user.uid] });
      await queryClient.cancelQueries({ queryKey: ["knowledge", user.uid] });
      const previousItems = queryClient.getQueryData([type, user.uid]);
      const previousKnowledge = queryClient.getQueryData(["knowledge", user.uid]);
      const optimisticTitle = payload.title || payload.fileName;
      const optimisticContent = payload.content;
      updateCaches(type, (current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...payload,
                title: optimisticTitle || item.title,
                content: optimisticContent ?? item.content,
                summary: type === "note" ? "Updating AI summary..." : item.summary,
              }
            : item
        )
      );
      setEditingItem(null);
      return { previousItems, previousKnowledge, type };
    },
    onSuccess: (data, variables, context) => {
      void data;
      void variables;
      queryClient.invalidateQueries({ queryKey: [context.type, user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Updated successfully.");
    },
    onError: (error, variables, context) => {
      void variables;
      if (context?.type) queryClient.setQueryData([context.type, user.uid], context.previousItems || []);
      queryClient.setQueryData(["knowledge", user.uid], context?.previousKnowledge || []);
      toast.error(error.message);
    },
  });

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((item) => {
          const canEdit = item.type === "note" || item.type === "document";
          return (
            <KnowledgeCard 
              key={`${item.type}-${item.id}`} 
              item={item} 
              onEdit={canEdit ? () => setEditingItem(item) : undefined}
              onDelete={() => setConfirmingItem(item)}
            />
          );
        })}
      </div>
      {confirmingItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/50 p-4 backdrop-blur-sm dark:bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-ink dark:text-white">Delete this item?</h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-zinc-300">
                  This will permanently remove <span className="font-semibold">{confirmingItem.title || confirmingItem.fileName || "Untitled"}</span> from your knowledge base.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmingItem(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button type="button" variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(confirmingItem)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {editingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 p-4 pt-20 backdrop-blur-sm dark:bg-black/50">
          <div className="mx-auto max-w-2xl relative">
            <NoteForm 
              key={editingItem.id}
              initialData={editingItem} 
              loading={updateMutation.isPending} 
              onCancel={() => setEditingItem(null)} 
              onSubmit={(payload) => updateMutation.mutate({ 
                id: editingItem.id, 
                type: editingItem.type, 
                originalText: editingItem.extractedText, 
                payload 
              })} 
            />
          </div>
        </div>
      )}
    </>
  );
}
