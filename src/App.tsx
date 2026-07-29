import { memo, useMemo, useState, useCallback } from "react";
import type { Recall, RecallDataset } from "./types/recall";
import rawData from "./data/recalls.json";
import "./App.css";

const dataset = rawData as RecallDataset;

const RecallCard = memo(function RecallCard({
  recall,
  onSelect,
}: {
  recall: Recall;
  onSelect: (r: Recall) => void;
}) {
  return (
    <li className="recall-card" onClick={() => onSelect(recall)}>
      <div className="recall-card-header">
        <span className="badge">{recall.campaignNumber}</span>
        <span className="category">{recall.category}</span>
      </div>
      <h3>{recall.title}</h3>
      <p className="manufacturer">
        {recall.manufacturer}
        {recall.model ? ` - ${recall.model}` : ""}
      </p>
      <p className="reason">{recall.reason}</p>
    </li>
  );
});

interface AiCitation {
  url?: string;
  title?: string;
}

function AiSearch() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<AiCitation[] | string[]>([]);
  const [error, setError] = useState("");

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setCitations([]);
    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur inconnue");
      }
      setAnswer(data.answer || "");
      setCitations(data.citations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [question]);

  return (
    <div className="ai-search">
      <h2 className="ai-search-title">🔎 Recherche IA en direct sur le web</h2>
      <p className="ai-search-subtitle">
        Posez une question libre, ex : "Le Renault Kangoo 2021 a-t-il un rappel en cours ?"
      </p>
      <div className="ai-search-controls">
        <input
          type="text"
          placeholder="Posez votre question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
        />
        <button onClick={handleAsk} disabled={loading || !question.trim()}>
          {loading ? "Recherche..." : "Demander"}
        </button>
      </div>
      {error && <p className="ai-search-error">{error}</p>}
      {answer && (
        <div className="ai-search-answer">
          <p>{answer}</p>
          {citations.length > 0 && (
            <div className="ai-search-citations">
              <strong>Sources :</strong>
              <ul>
                {citations.map((c, i) => {
                  const url = typeof c === "string" ? c : c.url;
                  const label = typeof c === "string" ? c : c.title || c.url;
                  return (
                    <li key={i}>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [selected, setSelected] = useState<Recall | null>(null);

  const categories = useMemo(() => {
    const set = new Set(dataset.recalls.map((r) => r.category));
    return ["Toutes", ...Array.from(set).sort()];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dataset.recalls.filter((r) => {
      const matchesCategory = category === "Toutes" || r.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q) ||
        (r.model || "").toLowerCase().includes(q) ||
        r.campaignNumber.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const handleSelect = useCallback((r: Recall) => setSelected(r), []);

  return (
    <div className="app">
      <header className="header">
        <h1>Rappels &amp; Pannes Constructeurs</h1>
        <p className="subtitle">
          {dataset.count.toLocaleString("fr-FR")} fiches officielles &middot; source : {dataset.source}
        </p>
      </header>

      <AiSearch />

      <div className="controls">
        <input
          type="search"
          placeholder="Rechercher par modele, marque ou numero de campagne..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <p className="result-count">{filtered.length} resultat(s)</p>

      <ul className="recall-list">
        {filtered.map((r) => (
          <RecallCard key={r.id} recall={r} onSelect={handleSelect} />
        ))}
      </ul>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelected(null)}>
              ×
            </button>
            <span className="badge">{selected.campaignNumber}</span>
            <h2>{selected.title}</h2>
            <dl>
              <dt>Constructeur</dt>
              <dd>{selected.manufacturer}</dd>
              {selected.model && (
                <>
                  <dt>Modele</dt>
                  <dd>{selected.model}</dd>
                </>
              )}
              <dt>Categorie</dt>
              <dd>{selected.category}</dd>
              <dt>Date de publication</dt>
              <dd>{selected.publicationDate}</dd>
              <dt>Motif du rappel</dt>
              <dd>{selected.reason}</dd>
              <dt>Risque encouru</dt>
              <dd>{selected.riskDescription}</dd>
              {selected.remedy && (
                <>
                  <dt>Conduite a tenir</dt>
                  <dd>{selected.remedy}</dd>
                </>
              )}
            </dl>
            {selected.sourceUrl && (
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                Voir la fiche officielle &rarr;
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
