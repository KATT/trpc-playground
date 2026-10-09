# 0011 — `@since` uses the v12 prerelease version

| Proposal                                     | Date       | Status   | Supersedes | Superseded by |
| -------------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [21](../proposals/21-stability-and-jsdoc.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q21.2:** "to be clear we'll be some sort of prerelease of 12 not 12.0.0" — vNext is v12, released as prereleases. `@since` carries the actual prerelease version the API first shipped in, not `12.0.0`.

```ts
/** @since 12.0.0-<tag>.N */ // exact prerelease tag TBD
```

## Rationale

`@since 12.0.0` would claim a stable release that doesn't exist yet. Recording the real prerelease lets readers tell which prerelease introduced an API.

## Rejected alternatives

- `@since 12.0.0` for everything until stable.

## Parity impact

None.

## Follow-ups

- [ ] Pick the prerelease tag (`alpha`, `next`, `canary`, …) when releases start (22: no releases soon).
- [ ] Update 21's ST-A/ST-C sketches, which use `@since 12.0.0`.
