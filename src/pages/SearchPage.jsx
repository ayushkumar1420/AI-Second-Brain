import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/Input";
import ManagedKnowledgeCard from "../components/ManagedKnowledgeCard";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import { useKnowledge } from "../hooks/useKnowledge";
import { generateEmbedding } from "../services/gemini";
import { rankByEmbedding } from "../utils/vector";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [semantic, setSemantic] = useState([]);
  const [loading, setLoading] = useState(false);
  const { data = [] } = useKnowledge();
  const keywordResults = useMemo(() => {
    if (!query.trim()) return data;
    const needle = query.toLowerCase();
    return data.filter((item) => `${item.title} ${item.content} ${item.summary}`.toLowerCase().includes(needle));
  }, [data, query]);

  async function runSemanticSearch() {
    setLoading(true);
    const embedding = await generateEmbedding(query);
    setSemantic(rankByEmbedding(data, embedding, 10));
    setLoading(false);
  }

  const results = semantic.length ? semantic : keywordResults;

  return (
    <>
      <PageHeader title="Search" description="Use keyword search instantly or semantic search with Gemini embeddings." />
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row">
        <Input label="Search your knowledge" value={query} onChange={(event) => { setQuery(event.target.value); setSemantic([]); }} placeholder="How does user login work?" />
        <Button className="self-end" loading={loading} disabled={!query.trim()} onClick={runSemanticSearch}>
          <Search className="h-4 w-4" /> Search uploads
        </Button>
      </div>
      {results.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map((item) => <ManagedKnowledgeCard key={`${item.type}-${item.id}`} item={item} />)}</div>
      ) : (
        <EmptyState icon={Search} title="No matching knowledge" body="Try a broader phrase or add more notes, PDFs, and links." />
      )}
    </>
  );
}
