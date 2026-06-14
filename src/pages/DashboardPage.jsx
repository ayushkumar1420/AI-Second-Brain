import { FileText, Link as LinkIcon, MessageSquare, Search, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import ManagedKnowledgeCard from "../components/ManagedKnowledgeCard";
import Button from "../components/Button";
import { useKnowledge } from "../hooks/useKnowledge";

export default function DashboardPage() {
  const { data = [], isLoading } = useKnowledge();
  const notes = data.filter((item) => item.type === "note").length;
  const documents = data.filter((item) => item.type === "document").length;
  const links = data.filter((item) => item.type === "link").length;

  return (
    <>
      <PageHeader title="Dashboard" description="A quick read on your personal knowledge base.">
        <Link to="/app/chat"><Button><MessageSquare className="h-4 w-4" /> Ask AI</Button></Link>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={StickyNote} label="Notes" value={notes} />
        <StatCard icon={FileText} label="Documents" value={documents} tone="bg-coral/10 text-coral" />
        <StatCard icon={LinkIcon} label="Links" value={links} tone="bg-gold/20 text-yellow-700" />
        <StatCard icon={Search} label="Searchable items" value={data.length} tone="bg-sky-100 text-sky-700" />
      </div>
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink dark:text-white">Recent knowledge</h2>
          <Link className="text-sm font-semibold text-fern" to="/app/search">Search all</Link>
        </div>
        {isLoading ? (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-500 dark:border-zinc-800 dark:bg-zinc-900">Loading knowledge...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.slice(0, 6).map((item) => <ManagedKnowledgeCard key={`${item.type}-${item.id}`} item={item} />)}
          </div>
        )}
      </section>
    </>
  );
}
