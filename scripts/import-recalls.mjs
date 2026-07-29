#!/usr/bin/env node
/**
 * Import combine de vraies fiches de rappel automobile :
 * - France : RappelConso V2 (DGCCRF), categorie automobile, Licence Ouverte 2.0
 * - USA : NHTSA (National Highway Traffic Safety Administration), donnees publiques officielles
 * Aucun numero de campagne n'est invente : uniquement des fiches reelles.
 *
 * Note de transparence : NHTSA ne couvre que les vehicules homologues et vendus aux USA.
 * Les marques non vendues aux USA (Renault, Peugeot, Citroen, Dacia, SEAT, Skoda, Opel,
 * marques chinoises, etc.) n'apparaitront donc que via la partie France (RappelConso)
 * si elles y sont presentes, ou pas du tout si aucune des deux sources ne les couvre.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TARGET_COUNT = parseInt(process.env.TARGET_COUNT || "1600", 10);
const OUT_PATH = path.resolve("src/data/recalls.json");

// ---------- FRANCE : RappelConso V2 ----------
const FR_BASE_URL =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records/";

function mapFrRecord(r) {
  return {
    id: "fr-" + String(r.id || r.rappel_guid || crypto.randomUUID()),
    campaignNumber: r.numero_fiche || "N/A",
    title: r.libelle || r.modeles_ou_references || "Rappel produit",
    manufacturer: r.marque_produit || "Inconnu",
    model: r.modeles_ou_references || undefined,
    category: "Automobile (France)",
    publicationDate: r.date_publication || "",
    riskDescription: r.risques_encourus || "",
    reason: r.motif_rappel || "",
    remedy: r.conduites_a_tenir_par_le_consommateur
      ? r.conduites_a_tenir_par_le_consommateur.replace(/\|/g, ", ")
      : undefined,
    sourceUrl: r.lien_vers_la_fiche_rappel || undefined,
  };
}

async function fetchFrancePage(offset) {
  const params = new URLSearchParams({
    lang: "fr",
    limit: "100",
    offset: String(offset),
    q: "automobile",
  });
  const url = `${FR_BASE_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return { results: [], total_count: 0 };
  return res.json();
}

async function fetchFranceRecalls() {
  const collected = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total && offset < 2000) {
    const page = await fetchFrancePage(offset);
    total = page.total_count ?? 0;
    if (!page.results || page.results.length === 0) break;
    for (const r of page.results) collected.push(mapFrRecord(r));
    offset += 100;
  }
  console.log(`France (RappelConso) : ${collected.length} fiches automobile recuperees`);
  return collected;
}

// ---------- USA : NHTSA ----------
const NHTSA_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";

const MAKES_MODELS = [
  // USA
  ["honda", "accord"], ["honda", "civic"], ["honda", "cr-v"], ["honda", "pilot"],
  ["toyota", "camry"], ["toyota", "corolla"], ["toyota", "rav4"], ["toyota", "highlander"],
  ["ford", "f-150"], ["ford", "escape"], ["ford", "explorer"], ["ford", "mustang"],
  ["chevrolet", "silverado"], ["chevrolet", "equinox"], ["chevrolet", "malibu"], ["chevrolet", "tahoe"],
  ["nissan", "altima"], ["nissan", "rogue"], ["nissan", "sentra"], ["nissan", "pathfinder"],
  ["jeep", "grand cherokee"], ["jeep", "wrangler"], ["jeep", "cherokee"],
  ["ram", "1500"], ["gmc", "sierra"], ["gmc", "terrain"],
  ["dodge", "charger"], ["dodge", "durango"], ["chrysler", "300"], ["chrysler", "pacifica"],
  ["cadillac", "escalade"], ["cadillac", "xt5"], ["lexus", "rx"], ["lexus", "es"],
  ["acura", "mdx"], ["acura", "rdx"], ["infiniti", "qx60"], ["buick", "encore"],
  ["hyundai", "elantra"], ["hyundai", "tucson"], ["hyundai", "santa fe"],
  ["kia", "sportage"], ["kia", "optima"], ["kia", "sorento"],
  ["subaru", "outback"], ["subaru", "forester"], ["subaru", "crosstrek"],
  ["mazda", "cx-5"], ["mazda", "3"], ["mazda", "cx-9"],
  ["mitsubishi", "outlander"], ["mitsubishi", "eclipse cross"], ["mitsubishi", "mirage"], ["mitsubishi", "asx"],
  ["tesla", "model 3"], ["tesla", "model y"],
  // Allemagne
  ["bmw", "3 series"], ["bmw", "x5"], ["bmw", "5 series"], ["bmw", "x3"],
  ["mercedes-benz", "c-class"], ["mercedes-benz", "e-class"], ["mercedes-benz", "gle"], ["mercedes-benz", "glc"],
  ["volkswagen", "jetta"], ["volkswagen", "tiguan"], ["volkswagen", "atlas"], ["volkswagen", "golf"],
  ["audi", "a4"], ["audi", "q5"], ["audi", "a6"], ["audi", "q7"],
  ["porsche", "cayenne"], ["porsche", "macan"], ["porsche", "911"],
  ["mini", "cooper"], ["mini", "countryman"],
  ["smart", "fortwo"],
  // Royaume-Uni
  ["land rover", "range rover"], ["land rover", "discovery"],
  ["jaguar", "f-pace"], ["jaguar", "xf"],
  ["bentley", "continental gt"], ["aston martin", "db11"], ["rolls-royce", "ghost"],
  // Suede
  ["volvo", "xc90"], ["volvo", "xc60"], ["volvo", "s60"],
  // Italie
  ["fiat", "500"], ["alfa romeo", "giulia"], ["alfa romeo", "stelvio"],
  ["maserati", "levante"], ["maserati", "ghibli"], ["ferrari", "portofino"],
  ["lamborghini", "urus"],
  // Asie (complement)
  ["suzuki", "swift"], ["suzuki", "vitara"],
  ["genesis", "g80"], ["genesis", "gv80"],
  ["isuzu", "d-max"],
  ["daihatsu", "terios"],
];

const YEARS = Array.from({ length: 16 }, (_, i) => 2010 + i); // 2010-2025

function mapNhtsaRecord(r) {
  return {
    id: "us-" + (r.NHTSACampaignNumber || crypto.randomUUID()) + "-" + r.Make + r.Model + r.ModelYear,
    campaignNumber: r.NHTSACampaignNumber || "N/A",
    title: `${r.Make} ${r.Model} ${r.ModelYear}`,
    manufacturer: r.Manufacturer || r.Make || "Inconnu",
    model: `${r.Model} (${r.ModelYear})`,
    category: "Automobile (USA - NHTSA)",
    publicationDate: r.ReportReceivedDate || "",
    riskDescription: r.Consequence || "",
    reason: r.Summary || r.Component || "",
    remedy: r.Remedy || undefined,
    sourceUrl: "https://www.nhtsa.gov/recalls?nhtsaId=" + (r.NHTSACampaignNumber || ""),
  };
}

async function fetchNhtsaRecalls(remaining) {
  const collected = [];
  outer:
  for (const [make, model] of MAKES_MODELS) {
    for (const year of YEARS) {
      if (collected.length >= remaining) break outer;
      const params = new URLSearchParams({ make, model, modelYear: String(year) });
      try {
        const res = await fetch(`${NHTSA_BASE}?${params.toString()}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          for (const r of data.results) collected.push(mapNhtsaRecord(r));
        }
      } catch {
        // ignore les echecs ponctuels, on continue avec la combinaison suivante
      }
    }
  }
  console.log(`USA (NHTSA) : ${collected.length} fiches automobile recuperees`);
  return collected;
}

async function main() {
  console.log(`Import automobile combine (France + USA) -> objectif ${TARGET_COUNT} fiches`);

  const franceRecalls = await fetchFranceRecalls();
  const remaining = Math.max(TARGET_COUNT - franceRecalls.length, 0);
  const usaRecalls = remaining > 0 ? await fetchNhtsaRecalls(remaining) : [];

  const allRecalls = [...franceRecalls, ...usaRecalls];

  if (allRecalls.length < TARGET_COUNT) {
    console.warn(
      `Attention: seulement ${allRecalls.length} fiches recuperees sur l'objectif de ${TARGET_COUNT}. ` +
      `Le script s'arrete quand meme et ecrit ce qui a ete trouve (donnees 100% reelles).`
    );
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const dataset = {
    generatedAt: new Date().toISOString(),
    source: "RappelConso (DGCCRF, France, Licence Ouverte 2.0) + NHTSA (USA, donnees publiques officielles)",
    count: allRecalls.length,
    recalls: allRecalls,
  };
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");
  console.log(`Termine: ${allRecalls.length} fiches ecrites dans ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Erreur import:", err.message);
  process.exit(1);
});
