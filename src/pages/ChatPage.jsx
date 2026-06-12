import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Bot, Send, User } from "lucide-react";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import { Textarea } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { askKnowledgeBase } from "../services/chatService";

const prompts = ["What did I save about authentication?", "Summarize my newest document.", "Turn my notes into next steps."];

export default function ChatPage() {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const mutation = useMutation({
    mutationFn: (prompt) => askKnowledgeBase(user.uid, prompt, messages),
    onSuccess: ({ answer, sources }, prompt) => {
      setMessages((current) => [...current, { role: "user", content: prompt, at: new Date().toISOString() }, { role: "assistant", content: answer, sources, at: new Date().toISOString() }]);
      setQuestion("");
    },
    onError: (error) => toast.error(error.message),
  });

  function ask(prompt = question) {
    if (!prompt.trim()) return;
    mutation.mutate(prompt);
  }

  return (
    <>
      <PageHeader title="AI Chat" description="A RAG assistant that answers from your stored content and cites sources." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="flex min-h-[62vh] flex-col rounded-lg border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Bot className="mx-auto mb-3 h-10 w-10 text-fern" />
                  <h2 className="font-bold text-ink dark:text-white">Ask your knowledge base</h2>
                  <p className="mt-1 max-w-md text-sm text-stone-500 dark:text-zinc-400">Gemini retrieves semantically relevant notes, PDFs, and links before answering.</p>
                </div>
              </div>
            )}
            {messages.map((message, index) => <ChatBubble key={`${message.at}-${index}`} message={message} />)}
            {mutation.isPending && <ChatBubble message={{ role: "assistant", content: "Reading your sources..." }} />}
          </div>
          <div className="border-t border-stone-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button key={prompt} className="rounded-md bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-600 dark:bg-zinc-800 dark:text-zinc-300" onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex w-full items-end gap-3">
              <div className="flex-1">
                <Textarea className="min-h-[48px]" 
                value={question} 
                onChange={(event) => setQuestion(event.target.value)} 
                placeholder="Ask about anything you saved..." />
              </div>
              <Button className="h-12 w-12 shrink-0" 
              loading={mutation.isPending} 
              onClick={() => ask()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
        <aside className="rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-bold text-ink dark:text-white">Retrieval workflow</h2>
          <ol className="mt-4 space-y-3 text-sm text-stone-600 dark:text-zinc-300">
            <li>1. Embed the question.</li>
            <li>2. Rank saved content with cosine similarity.</li>
            <li>3. Send top sources to Gemini.</li>
            <li>4. Display answer with references.</li>
          </ol>
        </aside>
      </div>
    </>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";
  const Icon = isUser ? User : Bot;
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-3xl gap-3 rounded-lg p-4 ${isUser ? "bg-fern text-white" : "bg-stone-100 text-ink dark:bg-zinc-800 dark:text-white"}`}>
        <Icon className="mt-1 h-4 w-4 shrink-0" />
        <div>
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          {Boolean(message.sources?.length) && (
            <div className="mt-3 space-y-1 border-t border-black/10 pt-3 text-xs">
              {message.sources.map((source, index) => (
                <p key={source.id}>[{index + 1}] {source.title} ({Math.round(source.score * 100)}%)</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
