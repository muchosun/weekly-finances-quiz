# Weekly Finances Quiz

An English, mobile-friendly acquisition quiz inspired by the iOS app Weekly Finances. Seven questions lead to a suggested weekly money routine, an optional weekly budget illustration, and an App Store link. Selecting an answer advances automatically; the optional amount form keeps an explicit Continue or Skip action. Back preserves answers.

Three optional interludes add a sourced fact-reveal interaction, a monthly/weekly budget explorer, and a personalised first-step reveal with generated human illustrations.

**[Open the test site](https://muchosun.github.io/weekly-finances-quiz/)**

[Original version without interludes](https://muchosun.github.io/weekly-finances-quiz/classic/) is preserved for manual comparison. Traffic is not randomly split; this is not an A/B experiment.

The GitHub Pages version is a **design preview**. Live CAPTCHA verification, analytics, purchases, and advertising campaigns are not enabled. Optional financial amounts stay in the browser tab and reset on reload. The result is a rule-based routine, not a financial assessment. Quiz answers do not transfer to the app.

## Run locally

Requires Node.js 22 or later. No npm dependencies.

```sh
cd weekly-finances-quiz
npm start
# http://127.0.0.1:4317
```

```sh
npm test
npm run check
npm run build:pages
```

`build:pages` generates a self-contained `pages/index.html` that works under a GitHub Pages project path. The checked-in copy in the root `docs/` folder is the GitHub Pages publishing source on `main`; server code and environment files are not served. To refresh it after edits:

```sh
cd ..
cp weekly-finances-quiz/pages/index.html docs/index.html
```

Tests and the build were run locally before publication. An optional deployment workflow is included for use after switching the Pages build type to GitHub Actions.

## Source

- `weekly-finances-quiz/dist/`: UI, styles, questions and result logic.
- `weekly-finances-quiz/scripts/build-preview.mjs`: standalone and Pages preview builds.
- `weekly-finances-quiz/server.mjs`: optional Node server for the live API.
- `weekly-finances-quiz/captcha.mjs`: Yandex SmartCaptcha token and host validation.
- `weekly-finances-quiz/tests/`: calculation, result, link and verification tests.
- `weekly-finances-quiz/research/fact-sources.json`: fact definitions, primary sources, population, fieldwork and sample.
- `weekly-finances-quiz/creative/illustration-prompts.json`: the three image prompts and generation provenance.

## Intermediate screens

After questions 2, 4 and 6, readers can reveal a research finding, switch their budget between monthly and weekly views, and reveal a first step based on their answers. Each interlude has Continue, Skip and Back. The fact panels link to the Federal Reserve's 2025 SHED findings and survey methodology, with the US adult population and survey year shown on the screen.

Personal amounts stay in browser memory. If amounts are skipped, the budget explorer labels all figures as an example; it does not substitute an invented personal budget. Deficits remain visible. None of the population percentages are presented as a personal match, an app result or a causal claim.

The three supporting portraits were generated with the built-in ImageGen tool and converted to compact WebP assets. Prompts are included in the source. [Issue #1](https://github.com/muchosun/weekly-finances-quiz/issues/1) records the original brief.

## Live verification

GitHub Pages hosts static files. Real SmartCaptcha requires a separately hosted server endpoint. The included Node server validates tokens with Yandex, checks the exact expected host, and rejects missing configuration, failed tokens, host mismatches and provider errors. See `weekly-finances-quiz/.env.example` for configuration names. Set private keys in your hosting secret store; never put them in the browser build.

Production mode does not automatically enable preview if its API is unavailable. Preview mode is explicitly marked in the generated static build. Real CAPTCHA tokens and the analytics integration have not been tested with account credentials.

## License and brand assets

Original source code is licensed under MIT. The Weekly Finances name and app icon are excluded from that license and remain the property of their respective rights holders. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
