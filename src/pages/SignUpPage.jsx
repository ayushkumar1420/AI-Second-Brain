import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Button from "../components/Button";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "./LoginPage";

export default function SignUpPage() {
  const { signUp, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm();

  async function onSubmit(values) {
    try {
      await signUp(values.name, values.email, values.password);
      navigate("/app");
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Start building a searchable, chat-ready library.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Name" autoComplete="name" {...register("name", { required: true })} />
        <Input label="Email" type="email" autoComplete="email" {...register("email", { required: true })} />
        <Input label="Password" type="password" autoComplete="new-password" {...register("password", { required: true, minLength: 8 })} />
        <Button className="w-full" loading={formState.isSubmitting}>Sign up</Button>
      </form>
      <Button variant="secondary" className="mt-5 w-full" onClick={loginWithGoogle}>Continue with Google</Button>
      <p className="mt-4 text-center text-sm text-stone-500">
        Already have an account? <Link className="font-semibold text-fern" to="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
