#!/usr/bin/env node
/**
 * Recherche IA (Perplexity, avec recherche web) de rappels reels pour les
 * marques francaises, avec source obligatoire.
 *
 * IMPORTANT - GARDE-FOU SECURITE :
 * Une fiche n'est retenue QUE si Perplexity fournit un lien source explicite.
 * Ces fiches sont marquees aiSourced:true et affichees differemment dans
 * l'app (pas comme un numero officiel verifie). Aucune fiche sans source
 * n'est ajoutee, pour eviter tout numero de campagne invente.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_PATH = path.resolve("src/data/recalls.json");
const API_KEY = process.env.PERPLEXITY_API_KEY;

const FRENCH_BRANDS = ["Renault", "Peugeot", "Citroen", "Dacia", "Opel", "Alpine", "DS Automobiles"];

if (!API_KEY) {
  console.error("PERPLEXITY_API_KEY manquante, arret.");
  process.exit(1);
}

async function askPerplexity(brand) {
  const prompt = `Liste les campagnes de rappel officielles reelles et verifiees pour des vehicules de la marque ${brand} en France ou en Europe (5 dernieres annees maximum). Pour CHAQUE rappel, tu dois IMPERATIVEMENT avoir une source officielle (site du constructeur, service-public.fr, ou presse specialisee fiable) sinon NE PAS l'inclure. Reponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, format exact :
[{"campaignNumber":"...","model":"...","year":"...","reason":"...","riskDescription":"...","remedy":"...","sourceUrl":"..."}]
Si tu n'as aucune information fiable et sourcee, reponds avec un tableau vide [].`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant rigoureux specialise dans les rappels automobiles. Tu ne donnes jamais d'information non sourcee. Format de reponse : JSON strict uniquement.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.warn(`Echec requete Perplexity pour ${brand}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "[]";

  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r.sourceUrl && r.sourceUrl.startsWith("http"));
  } catch {
    console.warn(`Reponse non-JSON pour ${brand}, ignoree.`);
    return [];
  }
}

function mapAiRecord(brand, r) {
  return {
    id: "ai-fr-" + brand + "-" + (r.campaignNumber || crypto.randomUUID()),
    campaignNumber: r.campaignNumber || "Non communique",
    title: `${brand} ${r.model || ""} ${r.year || ""}`.trim(),
    manufacturer: brand,
    model: r.model || undefined,
    year: r.year ? String(r.year) : undefined,
    category: "Automobile (France/Europe - recherche IA)",
    publicationDate: "",
    riskDescription: r.riskDescription || "",
    reason: r.reason || "",
    remedy: r.remedy || undefined,
    sourceUrl: r.sourceUrl,
    aiSourced: true,
  };
}

async function main() {
  console.log("Recherche IA (Perplexity) de rappels francais/europeens sources...");
  const collected = [];

  for (const brand of FRENCH_BRANDS) {
    console.log(`  Recherche pour ${brand}...`);
    const results = await askPerplexity(brand);
    for (const r of results) collected.push(mapAiRecord(brand, r));
    console.log(`  -> ${results.length} fiches sourcees trouvees pour ${brand}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`Total fiches IA sourcees : ${collected.length}`);

  const existing = JSON.parse(await readFile(OUT_PATH, "utf-8"));
  const merged = [...existing.recalls, ...collected];

  const dataset = {
    generatedAt: new Date().toISOString(),
    source: existing.source + " + recherche IA Perplexity (marques francaises, sources verifiees)",
    count: merged.length,
    recalls: merged,
  };

  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");
  console.log(`Termine: ${merged.length} fiches au total (${collected.length} ajoutees via IA)`);
}

main().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});
