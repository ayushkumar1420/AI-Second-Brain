import { Link } from "react-router-dom";
import { Brain, FileText, MessageSquare, Search, Shield } from "lucide-react";
import Button from "../components/Button";

const features = [
  { icon: FileText, title: "Capture everything", body: "Notes, PDFs, articles, and saved links become one searchable knowledge base." },
  { icon: Search, title: "Semantic recall", body: "Gemini embeddings find relevant ideas even when your wording changes." },
  { icon: MessageSquare, title: "Chat with sources", body: "Ask questions and get grounded answers with references to your content." },
  { icon: Shield, title: "Firebase security", body: "Auth, Firestore rules, and Storage rules keep each user's data isolated." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-ink dark:bg-zinc-950 dark:text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-3 font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-fern text-white">
            <Brain className="h-6 w-6" />
          </span>
          Second Brain
        </Link>
        <div className="flex gap-2">
          <Link to="/login">
            <Button variant="secondary">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button>Start</Button>
          </Link>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:py-20">
        <div>
          <p className="mb-4 inline-flex rounded-md bg-gold/20 px-3 py-1 text-sm font-semibold text-yellow-800">AI knowledge management</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Second Brain</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600 dark:text-zinc-300">
            Save what matters, generate summaries and study aids, then ask an AI assistant questions grounded in your own library.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button className="min-w-32">Create account</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="min-w-32">Open app</Button>
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
          <div className="rounded-md bg-stone-100 p-4 dark:bg-zinc-950">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-coral" />
              <span className="h-3 w-3 rounded-full bg-gold" />
              <span className="h-3 w-3 rounded-full bg-fern" />
            </div>
            <div className="space-y-3">
              <div className="rounded-md bg-white p-4 dark:bg-zinc-900">
                <p className="text-sm font-bold">How does user login work?</p>
                <p className="mt-2 text-sm text-stone-600 dark:text-zinc-300">Authentication notes, JWT docs, and authorization concepts are most relevant.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold">5</p>
                  <p className="text-sm text-stone-500">Knowledge items</p>
                </div>
                <div className="rounded-md bg-white p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-bold">2</p>
                  <p className="text-sm text-stone-500">AI summaries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-stone-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-stone-200 p-5 dark:border-zinc-800">
              <feature.icon className="mb-4 h-6 w-6 text-fern" />
              <h2 className="font-bold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-zinc-300">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
