# Contributing

## Before coding

- Read [`docs/agent-guide.md`](docs/agent-guide.md).
- Read the relevant feature route, Prisma models, frontend route, and existing tests before editing.
- Confirm whether the requested behavior is implemented, scaffolded, or entirely new.

## Repository rules

- `main` is protected; do not push directly to `main`.
- Use branch names like `feature/claim-form`.
- Keep pull requests small and focused.
- Request buddy review within 24 hours.
- Use conventional commits (example: `feat: add claim form scaffold`).
- Any schema, status lifecycle, or API contract change must be in a PR that tags all affected members.

## Implementation workflow

1. Define the user-visible behavior and owning feature.
2. Update the backend contract and validation boundary.
3. Implement persistence changes and create a Prisma migration when needed.
4. Wire the frontend through the existing router and API base URL.
5. Add tests for success and failure paths.
6. Update the relevant docs.
7. Run `npm run lint`, `npm run build`, and `npm run test`.

## AI-agent expectations

Agents must preserve existing architecture unless the task explicitly changes it. Do not replace TODO route modules with a new framework, move database models without a migration plan, or treat frontend guards as authorization. Prefer small, typed changes that can be reviewed independently.

## Pull requests

Use the repository pull request template. The description must state what changed, link the issue when one exists, report validation commands and results, and identify documentation or migration changes.
