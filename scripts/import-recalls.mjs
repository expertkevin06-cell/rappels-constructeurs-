#!/usr/bin/env node
/**
 * Import de vraies fiches de rappel automobile depuis NHTSA (USA), traduites en francais.
 * Aucun numero de campagne n'est invente : uniquement des fiches reelles.
 *
 * Note de transparence : la traduction utilise l'API gratuite MyMemory (sans cle).
 * Elle a une limite quotidienne de volume ; au-dela, le texte original en anglais
 * est conserve pour cette fiche plutot que de faire echouer tout l'import.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TARGET_COUNT = parseInt(process.env.TARGET_COUNT || "1600", 10);
const OUT_PATH = path.resolve("src/data/recalls.json");
const NHTSA_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";

const MAKES_MODELS = [
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
  ["bmw", "3 series"], ["bmw", "x5"], ["bmw", "5 series"], ["bmw", "x3"], ["bmw", "1 series"],
  ["mercedes-benz", "c-class"], ["mercedes-benz", "e-class"], ["mercedes-benz", "gle"], ["mercedes-benz", "glc"], ["mercedes-benz", "s-class"],
  ["volkswagen", "jetta"], ["volkswagen", "tiguan"], ["volkswagen", "atlas"], ["volkswagen", "golf"], ["volkswagen", "passat"],
  ["audi", "a4"], ["audi", "q5"], ["audi", "a6"], ["audi", "q7"], ["audi", "a3"],
  ["porsche", "cayenne"], ["porsche", "macan"], ["porsche", "911"], ["porsche", "panamera"],
  ["mini", "cooper"], ["mini", "countryman"],
  ["smart", "fortwo"],
  ["land rover", "range rover"], ["land rover", "discovery"], ["land rover", "defender"],
  ["jaguar", "f-pace"], ["jaguar", "xf"], ["jaguar", "xe"],
  ["bentley", "continental gt"], ["aston martin", "db11"], ["rolls-royce", "ghost"],
  ["volvo", "xc90"], ["volvo", "xc60"], ["volvo", "s60"], ["volvo", "xc40"],
  ["fiat", "500"], ["alfa romeo", "giulia"], ["alfa romeo", "stelvio"],
  ["maserati", "levante"], ["maserati", "ghibli"], ["ferrari", "portofino"], ["lamborghini", "urus"],
];

const YEARS = Array.from({ length: 21 }, (_, i) => 2005 + i);

function mapNhtsaRecord(r) {
  return {
    id: "us-" + (r.NHTSACampaignNumber || crypto.randomUUID()) + "-" + r.Make + r.Model + r.ModelYear,
    campaignNumber: r.NHTSACampaignNumber || "N/A",
    title: `${r.Make} ${r.Model} ${r.ModelYear}`,
    manufacturer: (r.Make || "Inconnu").trim(),
    model: r.Model || "Inconnu",
    year: String(r.ModelYear || ""),
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
        // ignore, on continue
      }
    }
  }
  return collected;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateToFrench(text) {
  if (!text || text.trim().length === 0) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.slice(0, 490)
    )}&langpair=en|fr`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || translated.includes("QUERY LENGTH LIMIT")) return text;
    return translated;
  } catch {
    return text;
  }
}

async function translateRecalls(recalls) {
  console.log(`Traduction en francais de ${recalls.length} fiches (peut prendre du temps)...`);
  let translated = 0;
  for (const r of recalls) {
    r.riskDescription = await translateToFrench(r.riskDescription);
    await sleep(80);
    r.reason = await translateToFrench(r.reason);
    await sleep(80);
    if (r.remedy) {
      r.remedy = await translateToFrench(r.remedy);
      await sleep(80);
    }
    translated++;
    if (translated % 100 === 0) {
      console.log(`  ... ${translated}/${recalls.length} fiches traduites`);
    }
  }
  return recalls;
}

async function main() {
  console.log(`Import automobile NHTSA -> objectif ${TARGET_COUNT} fiches`);
  const recalls = await fetchNhtsaRecalls(TARGET_COUNT);

  if (recalls.length < TARGET_COUNT) {
    console.warn(
      `Attention: seulement ${recalls.length} fiches recuperees sur l'objectif de ${TARGET_COUNT}.`
    );
  }

  await translateRecalls(recalls);

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const dataset = {
    generatedAt: new Date().toISOString(),
    source: "NHTSA (USA, donnees officielles) - textes traduits automatiquement en francais",
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
