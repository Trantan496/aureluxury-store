# Initial task to paste into Codex

You are a senior full-stack engineer. Build or improve my professional fashion e-commerce website running on Node.js.

FIRST read AGENTS.md and all files in docs/, then inspect the actual repository.
- If there is working code, keep it and evolve it safely without replacing unrelated user changes.
- If this repository is empty, scaffold a clean Next.js App Router + TypeScript + Tailwind CSS application. Use the Node.js runtime. Separate routes, presentational components, business features, and infrastructure. Keep dependencies minimal.

DESIGN GOAL: Premium minimalist fashion storefront, responsive on mobile/tablet/desktop, clear hierarchy, accessible controls, modern navigation, refined typography, good whitespace, consistent colors, tasteful loading/hover/focus states. Use Vietnamese UI labels if no existing language convention.

CRITICAL ZERO-DATA RULE:
- Opening `/` must always show a polished complete homepage EVEN WITH ZERO PRODUCTS and BEFORE a working database is configured.
- Render hero, navigation, curated category navigation and footer from static content that is not misrepresented as actual inventory.
- A product query returning [] must show a clear intentional empty state.
- A database connectivity failure must show a controlled error state, not a white/blank screen; don't confuse an error with zero results.
- Search, cart and product catalog must each have an appropriate empty state.
- Do not invent price tags, sales, customer reviews, discount numbers, inventory or actual orders.

MVP IMPLEMENTATION ORDER:
1. Working route / with responsive site shell and polished empty-data homepage.
2. /products page and empty-state behavior, search affordance.
3. /cart empty state and navigation among public pages.
4. /admin foundation only if secure gating is actually implemented; otherwise document as pending.
5. Database schema and product CRUD as a later coherent phase. Do not block the homepage on DB setup.

Engineering requirements:
- Prefer server rendering; mark small interactive components with `use client` only when necessary.
- Use TypeScript strict, semantic HTML and keyboard-accessible UI.
- Validate input on server; secure admin operations; do not commit secrets.
- Implement 404 and error/loading views where relevant.
- Use real implementation, not only pseudocode. Ensure package scripts work with dependencies in package.json.
- Run npm install if permitted/needed, followed by checks available in the repository. State clearly what could not be verified.

MANDATORY RECORDING BEFORE ENDING TASK:
- Update docs/PROJECT_CONTEXT.md to reflect actual state (not plans).
- Add one detailed dated entry to docs/SESSION_LOG.md with changed paths and test results.
- Update docs/ROADMAP.md checkboxes only for truly finished work.
- Update docs/ARCHITECTURE.md if routes/folders changed.
- Add docs/DECISIONS.md entry only for material decisions.

Finally summarize in Vietnamese: completed features, routes to visit, files edited, commands and results, remaining risks, next small task. Do not claim anything was done unless you changed the repository.
