# Weekly Finances Quiz

An English, mobile-friendly acquisition quiz inspired by the iOS app Weekly Finances. Seven questions lead to a suggested weekly money routine, an optional weekly budget illustration, and an App Store link. Selecting an answer advances automatically; the optional amount form keeps an explicit Continue or Skip action. Back preserves answers.

Three optional interludes add a sourced fact-reveal interaction, a monthly/weekly budget explorer, and a personalised first-step reveal with generated human illustrations.

**[Open the Cloudflare site](https://weekly-finances-quiz.muchosun.workers.dev/)**

[GitHub Pages design preview](https://muchosun.github.io/weekly-finances-quiz/) remains available.

[Original version without interludes](https://muchosun.github.io/weekly-finances-quiz/classic/) is preserved for manual comparison. Traffic is not randomly split; this is not an A/B experiment.

The GitHub Pages version is a **design preview**. The Cloudflare version serves both the quiz and its API through one Worker, with mandatory Turnstile verification and optional, consent-based Yandex Metrica. A missing server secret blocks completion. Purchases are not tracked by this quiz and no advertising spend is activated. Optional financial amounts stay in the browser tab and reset on reload. The result is a rule-based routine, not a financial assessment. Quiz answers do not transfer to the app.

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
- `weekly-finances-quiz/worker.mjs` and `worker-handler.mjs`: Cloudflare site and live API.
- `weekly-finances-quiz/wrangler.jsonc`: public deployment settings; the secret belongs in Cloudflare Secrets.
- `weekly-finances-quiz/server.mjs`: local Node development server.
- `weekly-finances-quiz/captcha.mjs`: Cloudflare Turnstile token, hostname and action validation.
- `weekly-finances-quiz/tests/`: calculation, result, link and verification tests.
- `weekly-finances-quiz/research/fact-sources.json`: fact definitions, primary sources, population, fieldwork and sample.
- `weekly-finances-quiz/creative/illustration-prompts.json`: the three image prompts and generation provenance.

## Intermediate screens

After questions 2, 4 and 6, readers can reveal a research finding, switch their budget between monthly and weekly views, and reveal a first step based on their answers. Each interlude has Continue, Skip and Back. The fact panels link to the Federal Reserve's 2025 SHED findings and survey methodology, with the US adult population and survey year shown on the screen.

Personal amounts stay in browser memory. If amounts are skipped, the budget explorer labels all figures as an example; it does not substitute an invented personal budget. Deficits remain visible. None of the population percentages are presented as a personal match, an app result or a causal claim.

The three supporting portraits were generated with the built-in ImageGen tool and converted to compact WebP assets. Prompts are included in the source. [Issue #1](https://github.com/muchosun/weekly-finances-quiz/issues/1) records the original brief.

## Live verification

The live site and `/api/config` / `/api/complete` are hosted together at `weekly-finances-quiz.muchosun.workers.dev`. The Worker validates each token with Cloudflare Siteverify and requires `success === true`, the exact production hostname and action `quiz_complete`. Tokens are single-use; missing configuration, expiry, replay, provider failures or mismatched hosts/actions block completion. The endpoint accepts a verification token only, never quiz answers or financial amounts.

```sh
npm run build:worker
```

This generates `build/site.mjs`, a self-contained site module with a CSP script hash. Deploy `worker.mjs`, `worker-handler.mjs`, `captcha.mjs`, and `build/site.mjs` as ES modules using the public settings in `wrangler.jsonc`. Keep the `TURNSTILE_SECRET` binding in the Cloudflare secret store and preserve it when updating the Worker. Never commit it. The private secret is not included in `/api/config`.

The production Worker cannot enter preview mode. Local design preview is limited to loopback by the Node server, and the GitHub Pages build marks preview explicitly. The GitHub Pages copy does not activate analytics or CAPTCHA.

## Analytics

Metrica counter `114081987` has two exact JavaScript goals: `quiz_complete` (ID `678849269`, verified plan displayed) and `app_store_click` (ID `678849315`, outbound App Store click). The script is loaded only after optional analytics consent. Webvisor, clickmap, automatic link tracking, automatic goals, ecommerce and Tag Manager are disabled. Financial inputs carry `ym-disable-keys` and the amount form carries `ym-disable-submit`. Quiz values and financial amounts are never sent. A store click is not an app install or a payment.

Advertising settings and budgets are kept outside this public source. Campaign launch and payment attribution require separate operational verification.

## License and brand assets

Original source code is licensed under MIT. The Weekly Finances name and app icon are excluded from that license and remain the property of their respective rights holders. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
