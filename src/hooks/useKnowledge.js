import { useQuery } from "@tanstack/react-query";
import { listAllKnowledge, listContent } from "../services/contentService";
import { useAuth } from "../context/AuthContext";

function cacheKey(userId, type) {
  return `second-brain:${userId}:${type}`;
}

function readLocalCache(userId, type) {
  if (!userId) return undefined;
  try {
    const cached = window.localStorage.getItem(cacheKey(userId, type));
    return cached ? JSON.parse(cached) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocalCache(userId, type, data) {
  if (!userId) return;
  try {
    window.localStorage.setItem(cacheKey(userId, type), JSON.stringify(data));
  } catch {
    // Ignore storage quota/private mode failures. Firestore remains the source of truth.
  }
}

export function useContent(type) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [type, user?.uid],
    queryFn: async () => {
      const data = await listContent(user.uid, type);
      writeLocalCache(user.uid, type, data);
      return data;
    },
    placeholderData: () => readLocalCache(user?.uid, type),
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
