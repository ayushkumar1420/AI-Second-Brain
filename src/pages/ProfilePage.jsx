import { User } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Profile" description="Account details from Firebase Authentication." />
      <div className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex items-center gap-3">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-md bg-emerald-100 text-fern"><User className="h-6 w-6" /></div>}
          <div>
            <p className="font-bold text-ink dark:text-white">{user?.displayName || "Second Brain User"}</p>
            <p className="text-sm text-stone-500">{user?.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <Input label="Name" value={user?.displayName || ""} readOnly />
          <Input label="Email" value={user?.email || ""} readOnly />
          <Input label="User ID" value={user?.uid || ""} readOnly />
        </div>
      </div>
    </>
  );
}
