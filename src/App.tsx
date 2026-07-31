import { memo, useMemo, useState, useCallback, useRef } from "react";
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
        <span className={recall.aiSourced ? "badge badge-ai" : "badge"}>
          {recall.campaignNumber}
        </span>
        <span className="category">{recall.category}</span>
      </div>
      <h3>{recall.title}</h3>
      <p className="manufacturer">
        {recall.manufacturer}
        {recall.model ? ` - ${recall.model}` : ""}
        {recall.year ? ` (${recall.year})` : ""}
      </p>
      <p className="reason">{recall.reason}</p>
    </li>
  );
});

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [brand, setBrand] = useState("Toutes");
  const [modelFilter, setModelFilter] = useState("Tous");
  const [selected, setSelected] = useState<Recall | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set(dataset.recalls.map((r) => r.category));
    return ["Toutes", ...Array.from(set).sort()];
  }, []);

  const brands = useMemo(() => {
    const set = new Set(dataset.recalls.map((r) => r.manufacturer));
    return ["Toutes", ...Array.from(set).sort()];
  }, []);

  const models = useMemo(() => {
    const pool =
      brand === "Toutes"
        ? dataset.recalls
        : dataset.recalls.filter((r) => r.manufacturer === brand);
    const set = new Set(pool.map((r) => r.model).filter(Boolean) as string[]);
    return ["Tous", ...Array.from(set).sort()];
  }, [brand]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dataset.recalls.filter((r) => {
      if (category !== "Toutes" && r.category !== category) return false;
      if (brand !== "Toutes" && r.manufacturer !== brand) return false;
      if (modelFilter !== "Tous" && r.model !== modelFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q) ||
        (r.model || "").toLowerCase().includes(q) ||
        r.campaignNumber.toLowerCase().includes(q)
      );
    });
  }, [query, category, brand, modelFilter]);

  const handleSelect = useCallback((r: Recall) => setSelected(r), []);

  const handleBrandChange = useCallback((value: string) => {
    setBrand(value);
    setModelFilter("Tous");
  }, []);

  const handleSearchIconClick = useCallback(() => {
    inputRef.current?.blur();
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Rappels &amp; Pannes Constructeurs</h1>
        <p className="subtitle">
          {dataset.count.toLocaleString("fr-FR")} fiches officielles &middot; source : {dataset.source}
        </p>
      </header>

      <div className="controls">
        <div className="search-box">
          <button
            type="button"
            className="search-icon-btn"
            onClick={handleSearchIconClick}
            aria-label="Rechercher"
          >
            🔍
          </button>
          <input
            ref={inputRef}
            type="search"
            placeholder="Rechercher par modele, marque ou numero de campagne..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="filters-row">
        <select value={brand} onChange={(e) => handleBrandChange(e.target.value)}>
          <option value="Toutes">Toutes les marques</option>
          {brands
            .filter((b) => b !== "Toutes")
            .map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
        </select>

        <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value="Tous">Tous les modeles</option>
          {models
            .filter((m) => m !== "Tous")
            .map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
        </select>

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
                  <dd>
                    {selected.model}
                    {selected.year ? ` (${selected.year})` : ""}
                  </dd>
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
