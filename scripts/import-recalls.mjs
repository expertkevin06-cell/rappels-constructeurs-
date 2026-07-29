#!/usr/bin/env node
/**
 * Import de vraies fiches de rappel automobile depuis NHTSA (USA).
 * Aucun numero de campagne n'est invente : uniquement des fiches reelles,
 * avec le numero de campagne officiel NHTSA (ex: 19V182000).
 *
 * Note de transparence : RappelConso (France) a ete retire de cet import.
 * Ses donnees ne couvrent pas reellement les vehicules (alimentaire, jouets,
 * electromenager, puericulture...) et remontaient du bruit non pertinent
 * (sieges auto, huile moteur, jouets miniatures) plutot que de vrais rappels
 * constructeur automobile. Les marques vendues uniquement en Europe et jamais
 * aux USA (Renault, Peugeot, Citroen, Dacia, SEAT, Skoda, Opel) ne peuvent
 * donc pas figurer ici : aucune source ouverte equivalente a NHTSA n'a ete
 * trouvee pour elles a ce jour.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TARGET_COUNT = parseInt(process.env.TARGET_COUNT || "1600", 10);
const OUT_PATH = path.resolve("src/data/recalls.json");
const NHTSA_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";

const MAKES_MODELS = [
  // USA
  ["honda", "accord"], ["honda", "civic"], ["honda", "cr-v"], ["honda", "pilot"], ["honda", "odyssey"],
  ["toyota", "camry"], ["toyota", "corolla"], ["toyota", "rav4"], ["toyota", "highlander"], ["toyota", "tacoma"],
  ["ford", "f-150"], ["ford", "escape"], ["ford", "explorer"], ["ford", "mustang"], ["ford", "focus"],
  ["chevrolet", "silverado"], ["chevrolet", "equinox"], ["chevrolet", "malibu"], ["chevrolet", "tahoe"], ["chevrolet", "cruze"],
  ["nissan", "altima"], ["nissan", "rogue"], ["nissan", "sentra"], ["nissan", "pathfinder"], ["nissan", "maxima"],
  ["jeep", "grand cherokee"], ["jeep", "wrangler"], ["jeep", "cherokee"], ["jeep", "compass"],
  ["ram", "1500"], ["ram", "2500"], ["gmc", "sierra"], ["gmc", "terrain"], ["gmc", "acadia"],
  ["dodge", "charger"], ["dodge", "durango"], ["dodge", "journey"],
  ["chrysler", "300"], ["chrysler", "pacifica"],
  ["cadillac", "escalade"], ["cadillac", "xt5"], ["cadillac", "ct5"],
  ["lexus", "rx"], ["lexus", "es"], ["lexus", "nx"],
  ["acura", "mdx"], ["acura", "rdx"], ["acura", "tlx"],
  ["infiniti", "qx60"], ["infiniti", "q50"],
  ["buick", "encore"], ["buick", "enclave"],
  ["hyundai", "elantra"], ["hyundai", "tucson"], ["hyundai", "santa fe"], ["hyundai", "sonata"],
  ["kia", "sportage"], ["kia", "optima"], ["kia", "sorento"], ["kia", "soul"],
  ["subaru", "outback"], ["subaru", "forester"], ["subaru", "crosstrek"], ["subaru", "impreza"],
  ["mazda", "cx-5"], ["mazda", "3"], ["mazda", "cx-9"], ["mazda", "6"],
  ["mitsubishi", "outlander"], ["mitsubishi", "eclipse cross"], ["mitsubishi", "mirage"], ["mitsubishi", "asx"],
  ["tesla", "model 3"], ["tesla", "model y"], ["tesla", "model s"],
  ["suzuki", "swift"], ["suzuki", "vitara"],
  ["genesis", "g80"], ["genesis", "gv80"],
  ["isuzu", "d-max"], ["daihatsu", "terios"],
  // Allemagne
  ["bmw", "3 series"], ["bmw", "x5"], ["bmw", "5 series"], ["bmw", "x3"], ["bmw", "1 series"],
  ["mercedes-benz", "c-class"], ["mercedes-benz", "e-class"], ["mercedes-benz", "gle"], ["mercedes-benz", "glc"], ["mercedes-benz", "s-class"],
  ["volkswagen", "jetta"], ["volkswagen", "tiguan"], ["volkswagen", "atlas"], ["volkswagen", "golf"], ["volkswagen", "passat"],
  ["audi", "a4"], ["audi", "q5"], ["audi", "a6"], ["audi", "q7"], ["audi", "a3"],
  ["porsche", "cayenne"], ["porsche", "macan"], ["porsche", "911"], ["porsche", "panamera"],
  ["mini", "cooper"], ["mini", "countryman"],
  ["smart", "fortwo"],
  // Royaume-Uni
  ["land rover", "range rover"], ["land rover", "discovery"], ["land rover", "defender"],
  ["jaguar", "f-pace"], ["jaguar", "xf"], ["jaguar", "xe"],
  ["bentley", "continental gt"], ["aston martin", "db11"], ["rolls-royce", "ghost"],
  // Suede
  ["volvo", "xc90"], ["volvo", "xc60"], ["volvo", "s60"], ["volvo", "xc40"],
  // Italie
  ["fiat", "500"], ["alfa romeo", "giulia"], ["alfa romeo", "stelvio"],
  ["maserati", "levante"], ["maserati", "ghibli"], ["ferrari", "portofino"], ["lamborghini", "urus"],
];

const YEARS = Array.from({ length: 21 }, (_, i) => 2005 + i); // 2005-2025

function mapNhtsaRecord(r) {
  return {
    id: "us-" + (r.NHTSACampaignNumber || crypto.randomUUID()) + "-" + r.Make + r.Model + r.ModelYear,
    campaignNumber: r.NHTSACampaignNumber || "N/A",
    title: `${r.Make} ${r.Model} ${r.ModelYear}`,
    manufacturer: r.Manufacturer || r.Make || "Inconnu",
    model: `${r.Model} (${r.ModelYear})`,
    category: "Automobile",
    publicationDate: r.ReportReceivedDate || "",
    riskDescription: r.Consequence || "",
    reason: r.Summary || r.Component || "",
    remedy: r.Remedy || undefined,
    sourceUrl: "https://www.nhtsa.gov/recalls?nhtsaId=" + (r.NHTSACampaignNumber || ""),
  };
}

async function fetchNhtsaRecalls(target) {
  const collected = [];
  outer:
  for (const [make, model] of MAKES_MODELS) {
    for (const year of YEARS) {
      if (collected.length >= target) break outer;
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
  return collected;
}

async function main() {
  console.log(`Import automobile NHTSA -> objectif ${TARGET_COUNT} fiches`);
  const recalls = await fetchNhtsaRecalls(TARGET_COUNT);

  if (recalls.length < TARGET_COUNT) {
    console.warn(
      `Attention: seulement ${recalls.length} fiches recuperees sur l'objectif de ${TARGET_COUNT}. ` +
      `Donnees 100% reelles, ecrites telles quelles.`
    );
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const dataset = {
    generatedAt: new Date().toISOString(),
    source: "NHTSA (National Highway Traffic Safety Administration, USA) - donnees publiques officielles",
    count: recalls.length,
    recalls,
  };
  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");
  console.log(`Termine: ${recalls.length} fiches ecrites dans ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Erreur import:", err.message);
  process.exit(1);
});
