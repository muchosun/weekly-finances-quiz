# Weekly Finances Quiz

An English, mobile-friendly acquisition quiz inspired by the iOS app Weekly Finances. Seven questions lead to a suggested weekly money routine, an optional weekly budget illustration, and an App Store link. Selecting an answer advances automatically; the optional amount form keeps an explicit Continue or Skip action. Back preserves answers.

Three optional interludes add a sourced fact-reveal interaction, a monthly/weekly budget explorer, and a personalised first-step reveal with generated human illustrations.

**[Open the Cloudflare site](https://weekly-finances-quiz.muchosun.workers.dev/)**

[GitHub Pages design preview](https://muchosun.github.io/weekly-finances-quiz/) remains available.

[Original version without interludes](https://muchosun.github.io/weekly-finances-quiz/classic/) is preserved for manual comparison. Traffic is not randomly split; this is not an A/B experiment.

The GitHub Pages version is a **design preview**. The Cloudflare version serves both the quiz and its API through one Worker, with mandatory Turnstile verification and Yandex Metrica enabled by default without an interruption. Visitors can turn analytics off in Privacy; an explicit saved opt-out is respected. A missing server secret blocks completion. The quiz UI does not report purchases; the separate Apple notification receiver is described below. Optional financial amounts stay in the browser tab and reset on reload. The result is a rule-based routine, not a financial assessment. Quiz answers do not transfer to the app.

## Run locally

Requires Node.js 22 or later. Run `npm ci` before development or testing.

```sh
cd weekly-finances-quiz
npm ci
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
npm run build:deploy
```

This generates `build/site.mjs`, a self-contained site module with a CSP script hash, then bundles the full Worker into `build/worker-bundle.mjs`. Deploy that bundle using the public settings in `wrangler.jsonc`. Keep the `TURNSTILE_SECRET` binding in the Cloudflare secret store and preserve it when updating the Worker. Never commit it. The private secret is not included in `/api/config`.

The production Worker cannot enter preview mode. Local design preview is limited to loopback by the Node server, and the GitHub Pages build marks preview explicitly. The GitHub Pages copy does not activate analytics or CAPTCHA.

## Analytics

Metrica counter `114081987` has two exact JavaScript goals: `quiz_complete` (ID `678849269`, verified plan displayed) and `app_store_click` (ID `678849315`, outbound App Store click). Analytics starts by default on the live site without a popup. The footer’s Privacy dialog explains the collection and allows visitors to turn it off; a saved explicit opt-out prevents script loading and event delivery. Webvisor, clickmap, automatic link tracking, automatic goals, ecommerce and Tag Manager are disabled. Financial inputs carry `ym-disable-keys` and the amount form carries `ym-disable-submit`. Quiz values and financial amounts are never sent. A store click is not an app install or a payment.

Advertising settings and budgets are kept outside this public source. Campaign launch and payment attribution require separate operational verification.

## Apple payment notifications

The Cloudflare Worker accepts signed App Store Server Notifications V2 at `/api/apple/notifications/production` and `/api/apple/notifications/sandbox`. It uses Apple's server library and public Apple trust anchors, with certificate revocation checks enabled. A D1 ledger records minimal verified transaction data and deduplicates notifications and first-payment conversions. Financial quiz answers are not collected.

Payment attribution and export are **disabled** until the app can receive the anonymous `appAccountToken` from the web flow and the owner configures the Metrica OAuth secret. A plain App Store URL does not transfer the visitor identifier to a new installation. Unmatched payments stay in the ledger and are never guessed to belong to a quiz visitor. The existing quiz completion goal remains the advertising optimization goal.

Build the deployable Worker with `npm run build:deploy`. It bundles Apple's library and adapts its OCSP fetch call to the Workers runtime. Preserve all existing Worker secrets during deployment. The `METRICA_OAUTH_TOKEN` belongs only in Cloudflare Secrets. No Apple private key is required to receive and verify notifications.

The Russian [developer handoff](weekly-finances-quiz/payments/DEVELOPER_HANDOFF.txt) describes the app changes, first-payment definition, test cases and activation requirements. Receiving a real Apple notification and matching a conversion in Metrica require separate end-to-end verification.

## License and brand assets

Original source code is licensed under MIT. The Weekly Finances name and app icon are excluded from that license and remain the property of their respective rights holders. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).


## App installation banners

The HTML head requests Apple's native Smart App Banner with `apple-itunes-app` / app ID `6756235224`. Safari controls whether it appears, compatibility, dismissal and its App Store/Open action. The page cannot force its display on a particular quiz step. No app argument or affiliate/provider token is fabricated, and quiz answers are not passed to the app.

On the result screen, a separate Weekly Finances banner offers the existing App Store link. It is dismissible, stays dismissed in the current tab, hides on other quiz steps and is independent of analytics settings. The page reserves space so the floating card does not prevent access to footer controls. Its link uses the same validated, market-aware App Store URL and the existing `app_store_click` goal with `placement=result_banner`; the original card uses `placement=result_card`. Tracking runs unless the visitor has explicitly turned it off.

Apple's native banner is browser UI, so its button clicks do not run the site's JavaScript goal handler. Verify actual native display on a physical supported iOS device; Apple's documentation says the banner is not shown in the iOS simulator. Source: [Apple Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners).

## Compact mobile flow

On phone widths the site masthead is hidden, while Apple’s native installation banner remains requested. Country selection is available in the home footer; quiz steps retain Back, progress and a compact Privacy control. Question copy, cards and gaps are shortened to keep the ordinary steps within a phone viewport. Interlude illustrations are compact, and omitted on short viewports. Expanded sources, large text, the software keyboard and the full result may scroll; content is never clipped or zoom-disabled.

The optional amount form uses decimal input, Next/Done keyboard hints, explicit labels, 44px+ touch targets and a preserved in-tab draft on Back. Invalid fields show a border and warning icon, briefly shake, and focus the first invalid input. Visible paragraphs are not added on validation. Field-specific explanations and a live error summary remain available to screen readers. The shake is suppressed by reduced-motion preferences. Enter advances between amount fields; zero bills or savings are valid, zero income is not; the whole optional step can always be skipped. Verification/network failures retain clear text and retry feedback. Turnstile uses its official compact size (150 × 140px) so the provider widget fits narrow phones without scaling or clipping.
