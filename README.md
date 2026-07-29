# Rappels & Pannes Constructeurs

Application web + mobile (APK) listant les campagnes de rappel et pannes connues,
avec numero de campagne officiel, source **DGCCRF / RappelConso** (data.economie.gouv.fr),
sous Licence Ouverte 2.0.

> Important : cette app n'affiche que des donnees reelles issues de la source
> officielle. Aucun numero de campagne n'est invente. Le fichier `src/data/recalls.json`
> est un placeholder tant que l'import n'a pas ete execute.

## 1. Recuperer les 1600+ fiches reelles

```bash
npm install
npm run import-recalls          # toutes categories, objectif 1600
# ou cible une categorie precise:
TARGET_COUNT=1600 CATEGORY="Automobiles" npm run import-recalls
```

Cette etape necessite un acces reseau (fonctionne en local ou dans GitHub Actions,
voir `.github/workflows/import-data.yml` qui la rejoue chaque semaine automatiquement
et commit les nouvelles fiches).

## 2. Developpement local

```bash
npm run dev
```

## 3. Publier sur GitHub

```bash
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<votre-user>/<votre-repo>.git
git push -u origin main
```

Les **security gates** se declenchent automatiquement sur chaque push/PR
(`.github/workflows/ci.yml`):
1. **Secret scanning** (Gitleaks) - bloque toute cle/API token committee
2. **SAST** (CodeQL) - analyse statique des vulnerabilites
3. **Audit des dependances** (`npm audit --audit-level=high`) - bloque les CVE critiques
4. **Lint + Typecheck** stricts
5. **Build** - ne se declenche que si les 4 gates precedents passent

Activez la **branch protection** sur `main` (Settings > Branches) pour exiger
que ces checks passent avant tout merge.

## 4. Deployer sur Vercel

- Importez le repo GitHub dans Vercel (vercel.com/new)
- Framework detecte automatiquement : Vite
- Vercel ne build que depuis `main`, apres succes des gates GitHub Actions

## 5. Construire l'APK (Android)

```bash
npm run build
npx cap add android      # premiere fois seulement
npm run cap:build:apk
```

L'APK genere se trouve dans `android/app/build/outputs/apk/debug/app-debug.apk`.
Il est directement telechargeable et partageable (installation via "sources inconnues"
sur Android, ou publication sur GitHub Releases pour un lien de partage public).

Pour un APK signe (release, pret pour distribution large) :
```bash
cd android && ./gradlew assembleRelease
```
(necessite une cle de signature, voir la doc officielle Capacitor/Android).

## Structure du projet

```
src/
  App.tsx           # UI: recherche, filtre par categorie, fiche detail
  data/recalls.json # donnees reelles (generees par le script d'import)
  types/recall.ts   # types TypeScript
scripts/
  import-recalls.mjs # import officiel RappelConso (DGCCRF)
.github/workflows/
  ci.yml            # security gates
  import-data.yml   # rafraichissement hebdomadaire des donnees
```
