# Publishing a Production-Grade npm Package: Complete Guide

---

## 1. Directory Structure

```
my-package/
├── src/
│   ├── index.ts          # Main entry point
│   └── constants.ts
├── dist/
│   ├── cjs/              # CommonJS output
│   ├── esm/              # ESM output
│   └── types/            # .d.ts declarations
├── tests/
│   └── index.test.ts
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── .npmignore            # (or use "files" in package.json — pick one)
├── package.json
├── tsconfig.json
├── tsconfig.cjs.json
├── tsconfig.esm.json
├── tsconfig.types.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

**Rule of thumb:** never rely on `.gitignore` to exclude files from npm. Use `"files"` in `package.json` (allowlist) or `.npmignore` (denylist). The `"files"` allowlist is preferred — it's explicit and harder to accidentally leak secrets.

---

## 2. package.json — The Full Picture

```json
{
  "name": "@crovver/sdk",
  "version": "1.0.0",
  "description": "Official Node.js/TypeScript SDK for Crovver",
  "author": "Crovver <engineering@crovver.com>",
  "license": "MIT",
  "homepage": "https://github.com/crovver/crovver-node#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/crovver/crovver-node.git"
  },
  "bugs": {
    "url": "https://github.com/crovver/crovver-node/issues"
  },

  "engines": {
    "node": ">=18.0.0"
  },

  "main":   "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types":  "./dist/types/index.d.ts",

  "exports": {
    ".": {
      "import": {
        "types":   "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types":   "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },

  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],

  "sideEffects": false,

  "peerDependencies": {
    "typescript": ">=4.7.0"
  },
  "peerDependenciesMeta": {
    "typescript": { "optional": true }
  },

  "dependencies": {
    "axios": "^1.7.0"
  },

  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "prettier": "^3.2.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.4.0"
  },

  "scripts": {
    "build":            "npm run build:cjs && npm run build:esm && npm run build:types",
    "build:cjs":        "tsc -p tsconfig.cjs.json",
    "build:esm":        "tsc -p tsconfig.esm.json",
    "build:types":      "tsc -p tsconfig.types.json",
    "clean":            "rm -rf dist",
    "prebuild":         "npm run clean",
    "typecheck":        "tsc --noEmit",
    "lint":             "eslint src --ext .ts",
    "lint:fix":         "eslint src --ext .ts --fix",
    "format":           "prettier --write \"src/**/*.ts\"",
    "format:check":     "prettier --check \"src/**/*.ts\"",
    "test":             "jest",
    "test:watch":       "jest --watch",
    "test:coverage":    "jest --coverage",
    "prepublishOnly":   "npm run lint && npm run typecheck && npm run test && npm run build",
    "release":          "np"
  },

  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

**Key fields explained:**

| Field | Why it matters |
|---|---|
| `"main"` | CJS fallback for old tooling that ignores `exports` |
| `"module"` | ESM hint for bundlers like Webpack/Rollup (non-standard but widely respected) |
| `"exports"` | The authoritative resolver for Node ≥12 and modern bundlers |
| `"sideEffects": false` | Enables tree-shaking — bundlers can drop unused exports |
| `"files"` | Allowlist — only these ship to npm; everything else is excluded |
| `"publishConfig"` | Ensures scoped packages are public; sets explicit registry |

---

## 3. TypeScript Config Setup

**`tsconfig.json`** (base):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "strict": true,
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "rootDir": "./src",
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**`tsconfig.cjs.json`**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "./dist/cjs",
    "declaration": false
  }
}
```

**`tsconfig.esm.json`**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/esm",
    "declaration": false
  }
}
```

**`tsconfig.types.json`**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/types",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true
  }
}
```

---

## 4. Testing & Static Analysis

### Jest + ts-jest setup (`jest.config.js`):
```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 70,
    },
  },
};
```

### ESLint (`.eslintrc.js`):
```js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

### Write actual tests — example:
```ts
// tests/client.test.ts
import { CrovverClient, CrovverError } from '../src/index';

describe('CrovverClient', () => {
  it('throws if apiKey is missing', () => {
    expect(() => new CrovverClient({ apiKey: '' }))
      .toThrow('CrovverConfig.apiKey is required');
  });

  it('uses custom baseUrl when provided', () => {
    const client = new CrovverClient({
      apiKey: 'test-key',
      baseUrl: 'http://localhost:3000',
    });
    expect(client).toBeInstanceOf(CrovverClient);
  });
});
```

---

## 5. GitHub Actions CI/CD

**`.github/workflows/ci.yml`**:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test with coverage
        run: npm run test:coverage

      - name: Build
        run: npm run build
```

**`.github/workflows/publish.yml`** — triggers on a GitHub Release:
```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # required for --provenance

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - run: npm ci
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 6. Documentation Essentials

### README structure:
```markdown
# @crovver/sdk

[![npm version](https://img.shields.io/npm/v/@crovver/sdk)](https://www.npmjs.com/package/@crovver/sdk)
[![CI](https://github.com/crovver/crovver-node/actions/workflows/ci.yml/badge.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> One-line description.

## Install

\`\`\`bash
npm install @crovver/sdk
\`\`\`

## Quick Start

\`\`\`ts
import { CrovverClient } from '@crovver/sdk';

const crovver = new CrovverClient({ apiKey: 'your-key' });
const { plans } = await crovver.getPlans();
\`\`\`

## API Reference

### `new CrovverClient(config)`
...

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md)

## License
MIT
```

### CHANGELOG — follow Keep a Changelog:
```markdown
## [1.1.0] - 2026-04-01
### Added
- `baseUrl` config option for local development

## [1.0.0] - 2026-03-01
### Added
- Initial release
```

### CONTRIBUTING.md essentials:
- How to set up locally (`npm ci && npm run build`)
- Branch naming convention (`feat/`, `fix/`, `chore/`)
- PR requirements (tests must pass, coverage must not drop)
- How to run tests

---

## 7. Semantic Versioning & Releases with `np`

**Install `np`:**
```bash
npm install --save-dev np
```

**`.np-config.json`** (or in `package.json` under `"np"`):
```json
{
  "yarn": false,
  "branch": "main",
  "testScript": "test",
  "preview": false
}
```

**Semantic versioning rules:**

| Change | Version bump | Example |
|---|---|---|
| Bug fix, patch | `patch` | `1.0.0` → `1.0.1` |
| New feature, backwards-compatible | `minor` | `1.0.0` → `1.1.0` |
| Breaking change | `major` | `1.0.0` → `2.0.0` |

**Release flow with `np`:**
```bash
# np handles: version bump, git tag, npm publish, GitHub release
npm run release        # runs `np` interactively
npm run release patch  # non-interactive patch bump
npm run release minor
npm run release major
```

`np` will automatically run your `prepublishOnly` script, create a git tag (`v1.1.0`), push to remote, and publish to npm.

**Manual git tagging** (if not using `np`):
```bash
npm version minor          # bumps package.json, creates commit + tag
git push origin main --follow-tags
npm publish
```

---

## 8. Publishing to npm — Step by Step

### Step 1 — Create an npm account
Go to [npmjs.com](https://www.npmjs.com), create an account, enable 2FA (required for publishing).

### Step 2 — Login locally
```bash
npm login
# or for 2FA-enforced accounts:
npm login --auth-type=web
```

### Step 3 — Configure `.npmrc` (project-level, committed)
```ini
# .npmrc
registry=https://registry.npmjs.org/
```

**Never commit auth tokens.** Your `~/.npmrc` (user-level, not committed) holds the token:
```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

### Step 4 — Dry run to verify what ships
```bash
npm publish --dry-run
```

Check the output carefully — confirm:
- No `.env` files or secrets included
- `dist/` is present and up to date
- Source `.ts` files are NOT included (unless intentional)

Also use:
```bash
npm pack
tar -tf crovver-sdk-1.0.0.tgz   # inspect tarball contents
```

### Step 5 — Publish with provenance
```bash
# Public scoped package
npm publish --access public --provenance

# Unscoped package
npm publish --provenance
```

`--provenance` generates a signed SLSA attestation linking the package to its source commit — consumers can verify it was built from your repo, not a compromised machine. Requires `id-token: write` permission in GitHub Actions.

### Step 6 — Verify publication
```bash
npm info @crovver/sdk
npm install @crovver/sdk   # test in a fresh directory
```

---

## 9. Scoped Packages & Access Control

### When to use a scoped package (`@org/name`):
- You have multiple related packages (`@crovver/sdk`, `@crovver/react`, `@crovver/cli`)
- You want namespace ownership — no one else can publish `@crovver/anything` except your org
- Avoiding name conflicts with existing unscoped packages

### Setup:
```bash
# Create an npm organization at npmjs.com/org/create
# Then scope your package:
npm init --scope=@crovver
```

### Access control in `package.json`:
```json
"publishConfig": {
  "access": "public"     // scoped packages default to "restricted" (paid) — set explicitly
}
```

| `publishConfig.access` | Meaning |
|---|---|
| `"public"` | Anyone can install — required for free orgs |
| `"restricted"` | Private package — requires paid npm org plan |

### Granular team access (npm orgs):
```bash
npm access grant read-only  @crovver:developers @crovver/sdk
npm access grant read-write @crovver:maintainers @crovver/sdk
```

---

## Quick Pre-Publish Checklist

```
[ ] npm run build        — dist is fresh and reflects latest source
[ ] npm run typecheck    — zero type errors
[ ] npm run lint         — zero lint errors
[ ] npm run test         — all tests pass, coverage threshold met
[ ] npm publish --dry-run — verify tarball contents (no secrets, dist present)
[ ] CHANGELOG.md updated — version entry added
[ ] package.json version bumped (or let np/release-it handle it)
[ ] git tag pushed       — v1.0.0 tag on main
[ ] npm publish --provenance --access public
```
