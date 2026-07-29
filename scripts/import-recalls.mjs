#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://data.economie.gouv.fr/api/records/1.0/search/";
const DATASET = "rappelconso0";
const PAGE_SIZE = 100;
const TARGET_COUNT = parseInt(process.env.TARGET_COUNT || "1600", 10);
const CATEGORY_FILTER = process.env.CATEGORY || "";
const OUT_PATH = path.resolve("src/data/recalls.json");

function mapRecord(record) {
  const f = record.fields || {};
  return {
    id: record.recordid || f.reference_fiche || crypto.randomUUID(),
    campaignNumber:
      f.numero_de_fiche ||
      f.reference_fiche ||
      f.identifiant ||
      f.numero_de_contact ||
      "N/A",
    title: f.nom_de_la_marque_du_produit
      ? `${f.nom_de_la_marque_du_produit} - ${f.noms_des_modeles_ou_references || ""}`.trim()
      : f.libelle || "Rappel produit",
    manufacturer: f.nom_de_la_marque_du_produit || f.societe_editrice || "Inconnu",
    model: f.noms_des_modeles_ou_references || undefined,
    category: f.categorie_de_produit || "Non categorise",
    publicationDate: f.date_de_publication || f.date_publication || "",
    riskDescription: f.risques_encourus_par_le_consommateur || "",
    reason: f.motif_du_rappel || "",
    remedy: f.conduites_a_tenir_par_le_consommateur || undefined,
    sourceUrl: f.lien_vers_la_fiche_rappel || undefined,
  };
}

async function fetchPage(start) {
  const params = new URLSearchParams({
    dataset: DATASET,
    rows: String(PAGE_SIZE),
    start: String(start),
    sort: "-date_de_publication",
  });
  if (CATEGORY_FILTER) {
    params.append("refine.categorie_de_produit", CATEGORY_FILTER);
  }
  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Echec requete API (${res.status}) sur ${url}`);
  }
  return res.json();
}

async function main() {
  console.log(`Import RappelConso -> objectif ${TARGET_COUNT} fiches`);
  const collected = [];
  let start = 0;
  let total = Infinity;

  while (collected.length < TARGET_COUNT && start < total) {
    const page = await fetchPage(start);
    total = page.nhits ?? 0;
    if (!page.records || page.records.length === 0) break;
    for (const record of page.records) {
      collected.push(mapRecord(record));
    }
    console.log(`  ... ${collected.length}/${Math.min(TARGET_COUNT, total)} recuperees`);
    start += PAGE_SIZE;
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const dataset = {
    generatedAt: new Date().toISOString(),
    source: "https://data.economie.gouv.fr/explore/dataset/rappelconso0/ (DGCCRF, Licence Ouverte 2.0)",
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
