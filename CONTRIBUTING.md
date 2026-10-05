# Contributing

Thanks for helping. Bug reports, fixes and ideas are all welcome.

## Reporting a bug

Open an issue with:

- your Obsidian version and platform (desktop or mobile, which OS)
- your theme, and whether it was light or dark
- the highlight as it appears in the note (the `<mark ...>` text), and what you expected to see

## Working on the code

```
npm install
npm run build   # bundles main.js
npm test        # tests for the readable-text colours and the highlight finder
npm run lint    # Obsidian's own review rules, the same ones it runs on every release
```

Copy `main.js`, `manifest.json` and `styles.css` into a test vault's `.obsidian/plugins/tinted-highlights/` folder, turn the plugin on, and reload Obsidian after each build.

The colour logic is in `src/utils/createStyles.ts` and the highlight finder in `src/utils/highlights.ts`. Neither depends on Obsidian, so changes there should come with a test in `test/logic.test.ts`.

## Pull requests

Keep a pull request to one change and say what it fixes. The plugin only changes text you select. Changes that reach the network or add dependencies need a strong reason.

## Releases

Maintainers bump the version in `manifest.json`, `package.json` and `versions.json`, write `RELEASE_NOTES.md`, and push a tag with the same version. The release workflow lints, tests, builds, attests and publishes the files.
