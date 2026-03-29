# Contributing to crovver-node

Thank you for your interest in contributing!

## Local Setup

```bash
git clone https://github.com/crovver/crovver-node.git
cd crovver-node
npm ci
npm run build
```

## Development Workflow

```bash
npm run typecheck      # type check without emitting
npm run lint           # lint source files
npm run test           # run tests
npm run test:watch     # run tests in watch mode
npm run test:coverage  # run tests with coverage report
npm run build          # compile to dist/
```

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<description>` | `feat/add-webhook-support` |
| Bug fix | `fix/<description>` | `fix/retry-on-network-error` |
| Chore | `chore/<description>` | `chore/update-dependencies` |

## Pull Request Requirements

- All tests must pass (`npm run test`)
- Coverage must not drop below thresholds defined in `jest.config.js`
- No TypeScript errors (`npm run typecheck`)
- No lint errors (`npm run lint`)
- Update `CHANGELOG.md` under an `[Unreleased]` section

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add webhook event handling
fix: correct retry logic for 408 timeout
chore: bump axios to 1.8.0
docs: update README quick start example
```

## Reporting Issues

Open an issue at https://github.com/crovver/crovver-node/issues with:
- Node.js version
- Package version
- Minimal reproduction case
