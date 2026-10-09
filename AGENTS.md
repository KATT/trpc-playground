# Agents

## Rewrite in progress

This repo is a **from-scratch rewrite** of tRPC (vNext / `v12` branch), not maintenance of current tRPC.

**New code lives in `next/`.** Do not add vNext packages to the root `packages/` tree (that is leftover v11). Design docs live in `vnext/`.

Start here:

- `ideas.md` — brief and constraints
- `next/README.md` — implementation root layout
- `vnext/approach.md` — process, principles, phases
- `vnext/README.md` — proposal index and how to decide
- `vnext/proposals/` — API proposals (options + recommendations; Alex decides)
- `vnext/decisions/` — accepted decisions (overrides proposals)
- `vnext/reference/` — oRPC parity, v11 inventory, prior art
- `vnext/notes/` — spikes and research

Search `vnext/` before designing or implementing. Implement under `next/`. Do not silently diverge from a recorded decision.

<!-- vendor-src:start -->

## Vendored Source

Source for this project's key dependencies is vendored under `.repos/`, pinned to the installed versions. When a question is about how one of these libraries actually behaves, read its vendored source — implementation, tests, examples — instead of relying on docs, memory, or web search. The trees are read-only reference material; see `.repos/AGENTS.md` before touching or citing them.

### Vendored packages

- `effect` (ref `effect@4.0.2`) → `.repos/effect`
- `orpc` (ref `v1.15.5`) → `.repos/orpc`

<!-- vendor-src:end -->
