# Contributing

Issues and pull requests are welcome.

For a bug report, include your DSH version, operating system, steps to reproduce, and expected behavior. For a feature request, explain the use case and its value.

## Local development

No build step is required. `client.js` is a classic browser script.

```bash
git clone https://github.com/Fyerl/dsh-2d-model-picker.git
cd dsh-2d-model-picker
npm run check
dsh plugin --profile web add .
```

Use your intended profile in place of `web`. For DSH Desktop, use its built-in plugin manager or the CLI installed by Desktop.

## Pull requests

Keep each PR focused, update `CHANGELOG.md`, and run `npm run check` (also run by CI). For UI changes, verify the result in DSH.
