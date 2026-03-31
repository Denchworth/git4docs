# Contributing to git4docs

## The short version

1. Fork the repo
2. Branch off `develop`
3. Make your changes
4. Open a pull request targeting `develop`

All pull requests go to `develop`. The `main` branch is reserved for releases.

## Setup

```bash
git clone https://github.com/YOUR-USERNAME/git4docs.git
cd git4docs
npm install
cd client && npm install && cd ..
npm run dev
```

Open `http://localhost:3001` and create a test account at `/signup`.

## Branch rules

- **`main`** is protected. No direct pushes. Only release merges from `develop`.
- **`develop`** is the active branch. All PRs target here.
- Name your branches descriptively: `fix/approval-reset-bug`, `feature/export-pdf`, `docs/setup-guide`.

## Pull requests

- One feature or fix per PR. Keep it focused.
- PRs are squash-merged, so your commit history on the branch doesn't need to be clean. The PR title and description become the commit message on `develop`, so make those count.
- If your change touches the UI, include a screenshot.
- If your change touches approval workflows or document lifecycle, explain the before and after behavior.

## What we're looking for

Check the [Issues](https://github.com/Denchworth/git4docs/issues) tab. Anything tagged `good first issue` is a reasonable entry point.

Areas where contributions are especially useful:

- Bug reports with reproduction steps
- Documentation improvements
- Test coverage
- Accessibility improvements
- Performance improvements on large document sets

## What to avoid

- Don't open a PR that reformats code you didn't otherwise change.
- Don't add dependencies without discussing it in an issue first.
- Don't change the document storage model (Git-backed markdown) without a very good reason and a discussion first. That's load-bearing architecture, not a style choice.

## Reporting bugs

Open an issue. Include:

- What you did
- What you expected
- What happened instead
- Browser, OS, Node version

## License

By contributing, you agree that your contributions are licensed under the [AGPL-3.0](LICENSE) license.
