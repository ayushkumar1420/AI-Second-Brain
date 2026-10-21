
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/Input";
import KnowledgeGrid from "../components/KnowledgeGrid";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import { useKnowledge } from "../hooks/useKnowledge";
import { generateEmbedding } from "../services/gemini";
import { listPdfChunks } from "../services/chunkService";
import { rankByEmbedding } from "../utils/vector";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [semantic, setSemantic] = useState(null);
  const [loading, setLoading] = useState(false);
  const { data = [] } = useKnowledge();

  const keywordResults = useMemo(() => {
    if (!query.trim()) return data;

    const needle = query.toLowerCase();

    return data.filter((item) =>
      `${item.title} ${item.content} ${item.summary}`
        .toLowerCase()
        .includes(needle)
    );
  }, [data, query]);

  async function runSemanticSearch() {
    if (!query.trim()) return;

    setLoading(true);
    setSemantic(null);

    try {
      const embedding = await generateEmbedding(query);
      const documents = data.filter((item) => item.type === "document");
      const chunks = await listPdfChunks(documents);

      const regularItems = data.filter((item) =>
        item.type !== "document" ||
        !item.chunkCount ||
        item.aiStatus !== "ready"
      );

      const ranked = rankByEmbedding(
        [...regularItems, ...chunks],
        embedding,
        40
      );

      const seen = new Set();
      const results = [];

      for (const item of ranked) {
        const key = `${item.type}:${item.id}`;

        if (seen.has(key)) continue;
        seen.add(key);

        const original = data.find(
          (entry) => entry.id === item.id && entry.type === item.type
        );

        results.push({
          ...(original || item),
          score: item.score,
          matchedPage: item.pageNumber || null,
        });

        if (results.length === 10) break;
      }

      setSemantic(results);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  const results = semantic === null ? keywordResults : semantic;

  return (
    <>
      <PageHeader
        title="Search"
        description="Search your notes, links, and indexed PDF pages."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <Input
          label="Search your knowledge"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSemantic(null);
          }}
          placeholder="How does distributed locking work?"
        />

        <Button
          className="self-end"
          loading={loading}
          disabled={!query.trim()}
          onClick={runSemanticSearch}
        >
          <Search className="h-4 w-4" />
          Search uploads
        </Button>
      </div>

      {results.length ? (
        <KnowledgeGrid data={results} />
      ) : (
        <EmptyState
          icon={Search}
          title="No matching knowledge"
          body="Try a broader phrase or add more notes, PDFs, and links."
        />
      )}
    </>
  );
}
