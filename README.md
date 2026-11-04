# Weekly Finances Quiz

An English, mobile-friendly acquisition quiz inspired by the iOS app Weekly Finances. Seven questions lead to a suggested weekly money routine, an optional weekly budget illustration, and an App Store link.

**[Open the test site](https://muchosun.github.io/weekly-finances-quiz/)**

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

`build:pages` generates a self-contained `pages/index.html` that works under a GitHub Pages project path. Only that output is deployed; server code and environment files are not served. The workflow runs tests before deployment.

## Source

- `weekly-finances-quiz/dist/`: UI, styles, questions and result logic.
- `weekly-finances-quiz/scripts/build-preview.mjs`: standalone and Pages preview builds.
- `weekly-finances-quiz/server.mjs`: optional Node server for the live API.
- `weekly-finances-quiz/captcha.mjs`: Yandex SmartCaptcha token and host validation.
- `weekly-finances-quiz/tests/`: calculation, result, link and verification tests.

## Live verification

GitHub Pages hosts static files. Real SmartCaptcha requires a separately hosted server endpoint. The included Node server validates tokens with Yandex, checks the exact expected host, and rejects missing configuration, failed tokens, host mismatches and provider errors. See `weekly-finances-quiz/.env.example` for configuration names. Set private keys in your hosting secret store; never put them in the browser build.

Production mode does not automatically enable preview if its API is unavailable. Preview mode is explicitly marked in the generated static build. Real CAPTCHA tokens and the analytics integration have not been tested with account credentials.

## License and brand assets

Original source code is licensed under MIT. The Weekly Finances name and app icon are excluded from that license and remain the property of their respective rights holders. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
