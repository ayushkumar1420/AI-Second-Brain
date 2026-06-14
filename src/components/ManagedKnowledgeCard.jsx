import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import KnowledgeCard from "./KnowledgeCard";
import NoteForm from "./NoteForm";
import { deleteContent, updateNote, updateDocument } from "../services/contentService";
import { useAuth } from "../context/AuthContext";

export default function ManagedKnowledgeCard({ item }) {
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteContent(item.type, item.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [item.type, user.uid] });
      const previousItems = queryClient.getQueryData([item.type, user.uid]);
      queryClient.setQueryData([item.type, user.uid], (current = []) => current.filter((entry) => entry.id !== item.id));
      return { previousItems };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [item.type, user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
    },
    onError: (error, vars, context) => {
      queryClient.setQueryData([item.type, user.uid], context?.previousItems || []);
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => {
      if (item.type === "note") return updateNote(item.id, payload);
      if (item.type === "document") return updateDocument(item.id, payload, item.extractedText);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: [item.type, user.uid] });
      const previousItems = queryClient.getQueryData([item.type, user.uid]);
      queryClient.setQueryData([item.type, user.uid], (current = []) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, ...payload, title: payload.title || payload.fileName, summary: "Updating AI summary..." }
            : entry
        )
      );
      setEditing(false);
      return { previousItems };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [item.type, user.uid] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", user.uid] });
      toast.success("Updated successfully.");
    },
    onError: (error, vars, context) => {
      queryClient.setQueryData([item.type, user.uid], context?.previousItems || []);
      toast.error(error.message);
    },
  });

  const canEdit = item.type === "note" || item.type === "document";

  return (
    <>
      <KnowledgeCard 
        item={item} 
        onEdit={canEdit ? () => setEditing(true) : undefined} 
        onDelete={() => deleteMutation.mutate()} 
      />
      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 p-4 pt-20 backdrop-blur-sm dark:bg-black/50">
          <div className="mx-auto max-w-2xl relative">
            <NoteForm 
              initialData={item} 
              loading={updateMutation.isPending} 
              onCancel={() => setEditing(false)} 
              onSubmit={(payload) => updateMutation.mutate(payload)} 
            />
          </div>
        </div>
      )}
    </>
  );
}
