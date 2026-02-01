export const REFACTOR_TEMPLATE = `# /refactor

Intelligent refactoring workflow. Be deterministic, verify constantly, and use LSP + AST-grep.

Usage:
/refactor <target> [--scope=file|module|project] [--strategy=safe|aggressive]

Phase 0 - Intent Gate
- If target or scope unclear, ask a clarifying question before doing work.
- Confirm success criteria and risk tolerance.

Phase 1 - Parallel Discovery
- Launch background explore agents to find target definitions, usages, and tests.
- In main session, run LSP and search tools to map scope.

Phase 2 - Codemap
- Build a codemap: core files, dependencies, and impact zones.
- Identify patterns that must be preserved.

Phase 3 - Test Assessment
- Determine test coverage for target.
- If coverage is low, propose adding tests or proceed with extra caution.

Phase 4 - Plan
- Use the plan agent to produce a step-by-step refactoring plan with verification steps.

Phase 5 - Execute
- Make small, verifiable changes.
- Use LSP rename for symbols.
- Use ast_grep_search and ast_grep_replace with dryRun true before applying.
- After each step: lsp_diagnostics, then run tests.

Phase 6 - Final Verification
- Run full test suite, type check, lint/build if applicable.
- Summarize changes and verification results.

Critical rules:
- Never proceed with failing tests.
- Never refactor without understanding existing patterns.
- Always preview AST-grep replacements first.

<user-request>
$ARGUMENTS
</user-request>
`
