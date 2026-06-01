import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BrainCircuit, GraduationCap, Sparkles } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useKnowledge } from "../hooks/useKnowledge";
import { generateFlashcards, generateQuiz } from "../services/gemini";

export default function InsightsPage() {
  const { data = [] } = useKnowledge();
  const [output, setOutput] = useState("");
  const combined = data.slice(0, 8).map((item) => `${item.title}\n${item.summary || item.content}`).join("\n\n");
  const flashcards = useMutation({
    mutationFn: () => generateFlashcards(combined),
    onSuccess: setOutput,
    onError: (error) => toast.error(error.message),
  });
  const quiz = useMutation({
    mutationFn: () => generateQuiz(combined),
    onSuccess: setOutput,
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Learning Insights" description="Generate flashcards, quizzes, and daily study material from your saved content.">
        <Button variant="secondary" loading={flashcards.isPending} disabled={!data.length} onClick={() => flashcards.mutate()}><GraduationCap className="h-4 w-4" /> Flashcards</Button>
        <Button loading={quiz.isPending} disabled={!data.length} onClick={() => quiz.mutate()}><Sparkles className="h-4 w-4" /> Quiz</Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-2xl font-bold text-ink dark:text-white">{data.length}</p><p className="text-sm text-stone-500">Items learned</p></div>
        <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-2xl font-bold text-ink dark:text-white">{data.filter((item) => item.summary).length}</p><p className="text-sm text-stone-500">Summaries</p></div>
        <div className="rounded-lg border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-2xl font-bold text-ink dark:text-white">{data.reduce((total, item) => total + (item.tags?.length || 0), 0)}</p><p className="text-sm text-stone-500">Tags</p></div>
      </div>
      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        {output ? <pre className="whitespace-pre-wrap text-sm leading-6 text-ink dark:text-white">{output}</pre> : <EmptyState icon={BrainCircuit} title="No generated study set" body="Create flashcards or a quiz from your most recent saved knowledge." />}
      </section>
    </>
  );
}
