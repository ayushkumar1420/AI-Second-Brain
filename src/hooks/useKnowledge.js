import { useQuery } from "@tanstack/react-query";
import { listAllKnowledge, listContent } from "../services/contentService";
import { useAuth } from "../context/AuthContext";

export function useContent(type) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [type, user?.uid],
    queryFn: () => listContent(user.uid, type),
    enabled: Boolean(user?.uid),
  });
}

export function useKnowledge() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["knowledge", user?.uid],
    queryFn: () => listAllKnowledge(user.uid),
    enabled: Boolean(user?.uid),
  });
}
