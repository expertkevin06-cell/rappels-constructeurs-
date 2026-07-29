#!/usr/bin/env node
/**
 * Import des fiches de rappel officielles depuis RappelConso V2 (data.economie.gouv.fr).
 * Source : DGCCRF / DGAL / DGEC / DGPR - Licence Ouverte / Open Licence 2.0
 * L'ancienne API V1 (records/1.0/search) a ete retiree fin 2025, remplacee par
 * l'API Explore v2.1 sur le jeu de donnees RappelConso V2.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records/";
const PAGE_SIZE = 100;
const TARGET_COUNT = parseInt(process.env.TARGET_COUNT || "1600", 10);
const CATEGORY_FILTER = process.env.CATEGORY || "";
const OUT_PATH = path.resolve("src/data/recalls.json");

function mapRecord(r) {
  return {
    id: String(r.id || r.rappel_guid || crypto.randomUUID()),
    campaignNumber: r.numero_fiche || "N/A",
    title: r.libelle || r.modeles_ou_references || "Rappel produit",
    manufacturer: r.marque_produit || "Inconnu",
    model: r.modeles_ou_references || undefined,
    category: r.categorie_produit || "Non categorise",
    publicationDate: r.date_publication || "",
    riskDescription: r.risques_encourus || "",
    reason: r.motif_rappel || "",
    remedy: r.conduites_a_tenir_par_le_consommateur
      ? r.conduites_a_tenir_par_le_consommateur.replace(/\|/g, ", ")
      : undefined,
    sourceUrl: r.lien_vers_la_fiche_rappel || undefined,
  };
}

async function fetchPage(offset) {
  const params = new URLSearchParams({
    lang: "fr",
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (CATEGORY_FILTER) {
    params.append("refine", `categorie_produit:${CATEGORY_FILTER}`);
  }
  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Echec requete API (${res.status}) sur ${url}`);
  }
  return res.json();
}

async function main() {
  console.log(`Import RappelConso V2 -> objectif ${TARGET_COUNT} fiches`);
  const collected = [];
  let offset = 0;
  let total = Infinity;

  while (collected.length < TARGET_COUNT && offset < total) {
    const page = await fetchPage(offset);
    total = page.total_count ?? 0;
    if (!page.results || page.results.length === 0) break;
    for (const record of page.results) {
      collected.push(mapRecord(record));
    }
    console.log(`  ... ${collected.length}/${Math.min(TARGET_COUNT, total)} recuperees`);
    offset += PAGE_SIZE;
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const dataset = {
    generatedAt: new Date().toISOString(),
    source: "https://data.economie.gouv.fr (RappelConso V2, DGCCRF, Licence Ouverte 2.0)",
    count: collected.length,
    recalls: collected,
  };
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");
  console.log(`Termine: ${collected.length} fiches ecrites dans ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Erreur import:", err.message);
  process.exit(1);
});
