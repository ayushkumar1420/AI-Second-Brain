import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Brain } from "lucide-react";
import Button from "../components/Button";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../firebase/config";

export default function LoginPage() {
  const { login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState } = useForm();

  async function onSubmit(values) {
    try {
      await login(values.email, values.password);
      navigate("/app");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function onReset() {
    const email = watch("email");
    if (!email) return toast.error("Enter your email first.");
    try {
      await resetPassword(email);
      toast.success("Password reset email sent.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function onGoogleLogin() {
    try {
      await loginWithGoogle();
      navigate("/app");
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Open your private knowledge base.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Email" type="email" autoComplete="email" {...register("email", { required: true })} />
        <Input label="Password" type="password" autoComplete="current-password" {...register("password", { required: true })} />
        <Button className="w-full" loading={formState.isSubmitting}>Log in</Button>
      </form>
      <div className="mt-3 flex justify-between text-sm">
        <button className="font-semibold text-fern" onClick={onReset}>Reset password</button>
        <Link className="font-semibold text-fern" to="/signup">Create account</Link>
      </div>
      <Button variant="secondary" className="mt-5 w-full" onClick={onGoogleLogin}>Continue with Google</Button>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen place-items-center bg-stone-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <Link to="/" className="mb-6 flex items-center gap-3 font-bold text-ink dark:text-white">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-fern text-white">
            <Brain className="h-6 w-6" />
          </span>
          Second Brain
        </Link>
        <h1 className="text-2xl font-bold text-ink dark:text-white">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-stone-500 dark:text-zinc-400">{subtitle}</p>
        {!isFirebaseConfigured && (
          <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Firebase environment values are missing. Add a `.env` file from `.env.example`, then restart the dev server.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
