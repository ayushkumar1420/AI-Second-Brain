import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export function logActivity(userId, action, detail) {
  if (!userId) return Promise.resolve();
  return addDoc(collection(db, "activities"), {
    userId,
    action,
    detail,
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
}
