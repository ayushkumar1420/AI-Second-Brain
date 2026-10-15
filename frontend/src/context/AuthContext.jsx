import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured, requireFirebase } from "../firebase/config";

const AuthContext = createContext(null);

function profilePayload(user, extra = {}) {
  return {
    uid: user.uid,
    name: user.displayName || extra.name || "Second Brain User",
    email: user.email,
    photoURL: user.photoURL || "",
    createdAt: serverTimestamp(),
    ...extra,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isFirebaseConfigured,
      async signUp(name, email, password) {
        requireFirebase();
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await setDoc(doc(db, "users", credential.user.uid), profilePayload(credential.user, { name }), { merge: true });
      },
      async login(email, password) {
        requireFirebase();
        await signInWithEmailAndPassword(auth, email, password);
      },
      async loginWithGoogle() {
        requireFirebase();
        const credential = await signInWithPopup(auth, googleProvider);
        await setDoc(doc(db, "users", credential.user.uid), profilePayload(credential.user), { merge: true });
      },
      async resetPassword(email) {
        requireFirebase();
        await sendPasswordResetEmail(auth, email);
      },
      async logout() {
        requireFirebase();
        await signOut(auth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
