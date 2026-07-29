# PokéMeta · Daily Meta Decks Evaluation

A static visual archive for Pokémon Challenge deck meta analysis.

## Live Website

<https://zrwrz.github.io/pokemon-challenge-meta-analysis/>

## Features

- Daily and cumulative report modes;
- Date selection for daily reports;
- Start-to-end date ranges for cumulative reports;
- Four daily analysis figures displayed on one page;
- Full-size image viewing on desktop and mobile;
- Automatic gallery updates after new analysis figures are pushed.

## Adding New Reports

Daily reports use the following directory structure:

```text
meta-analysis/YYYY-MM-DD/figures/
```

Cumulative reports use a start-to-end date range:

```text
meta-analysis/YYYY-MM-DD_to_YYYY-MM-DD/figures/
```

After adding the new figures, commit and push them:

```bash
git add meta-analysis
git commit -m "add new meta analysis"
git push origin main
```

The gallery manifest is rebuilt automatically. GitHub Pages may take a minute or two to refresh.

## Local Preview

```bash
npm run dev
```

Then open <http://127.0.0.1:4173/>.
