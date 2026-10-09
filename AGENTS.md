# Agents

## tRPC vNext design docs

Design work for the next version of tRPC lives in `vnext/` (brief: `ideas.md`). Before designing or implementing anything for vNext:

- Read `vnext/approach.md` for the process, principles and workflow.
- Search `vnext/` first (`rg -n "<topic>" vnext/`). Decisions in `vnext/decisions/` override proposals in `vnext/proposals/`, which override memory.
- Never silently diverge from a recorded decision. Propose a superseding one instead.
- Flag any choice that could block a row in `vnext/reference/orpc-parity.md`, and ask before recording it.
- Write research and spike results to `vnext/notes/`.

<!-- vendor-src:start -->

## Vendored Source

Source for this project's key dependencies is vendored under `.repos/`, pinned to the installed versions. When a question is about how one of these libraries actually behaves, read its vendored source — implementation, tests, examples — instead of relying on docs, memory, or web search. The trees are read-only reference material; see `.repos/AGENTS.md` before touching or citing them.

### Vendored packages

- `effect` (ref `effect@4.0.2`) → `.repos/effect`
- `orpc` (ref `v1.15.5`) → `.repos/orpc`

<!-- vendor-src:end -->
