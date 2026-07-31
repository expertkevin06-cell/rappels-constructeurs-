#!/usr/bin/env node
/**
 * Recherche IA (Perplexity, avec recherche web reelle) de rappels pour les
 * marques francaises.
 *
 * IMPORTANT - GARDE-FOU SECURITE :
 * On utilise les vraies citations renvoyees par l'API Perplexity (issues de
 * sa recherche web reelle), pas des URLs generees de memoire par le modele.
 * Une fiche n'est creee QUE s'il y a au moins une citation web reelle.
 * Ces fiches sont marquees aiSourced:true.
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
  const prompt = `Quelles sont les campagnes de rappel de vehicules ${brand} les plus recentes (5 dernieres annees) en France ou en Europe ? Donne les modeles concernes, l'annee, le motif du rappel et le risque encouru. Reponds en francais, de maniere factuelle.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant factuel specialise dans les rappels automobiles. Base-toi uniquement sur des informations verifiables.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (err) {
    console.warn(`  [${brand}] Timeout ou erreur reseau: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    console.warn(`  [${brand}] Echec requete: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || "";
  const citations = Array.isArray(data.citations) ? data.citations : [];

  console.log(`  [${brand}] Reponse: ${answer.length} caracteres, ${citations.length} citations reelles`);

  if (citations.length === 0) {
    console.log(`  [${brand}] Aucune citation web reelle -> fiche ignoree.`);
    return null;
  }

  return { answer, citations };
}

function mapAiRecord(brand, answer, citations) {
  return {
    id: "ai-fr-" + brand + "-" + Date.now(),
    campaignNumber: "Non communique (synthese IA)",
    title: `${brand} - Synthese des rappels recents`,
    manufacturer: brand,
    model: undefined,
    year: undefined,
    category: "Automobile (France/Europe - recherche IA)",
    publicationDate: "",
    riskDescription: answer.slice(0, 1000),
    reason: "Synthese generee par recherche IA (Perplexity), basee sur des sources web reelles listees ci-dessous.",
    remedy: undefined,
    sourceUrl: citations[0],
    aiSourced: true,
  };
}

async function main() {
  console.log("Recherche IA (Perplexity) de rappels francais/europeens, avec citations reelles...");
  const collected = [];

  for (const brand of FRENCH_BRANDS) {
    console.log(`Recherche pour ${brand}...`);
    const result = await askPerplexity(brand);
    if (result) {
      collected.push(mapAiRecord(brand, result.answer, result.citations));
      console.log(`  -> Fiche ajoutee pour ${brand} avec ${result.citations.length} sources reelles`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`Total fiches IA ajoutees : ${collected.length}`);

  const existing = JSON.parse(await readFile(OUT_PATH, "utf-8"));
  const merged = [...existing.recalls, ...collected];

  const dataset = {
    generatedAt: new Date().toISOString(),
    source: existing.source + " + synthese IA Perplexity (marques francaises, avec sources web reelles)",
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
