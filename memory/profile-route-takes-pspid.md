---
name: profile-route-takes-pspid
description: "/poslanec/[id] resolves real psp.cz ids, so links built from the lib/civic mock MP ids (e.g. novakova-p) return 404."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c9c34d2-915c-40e2-83b4-1fc1a71eda67
  modified: 2026-07-26T11:08:51.770Z
---

`/poslanec/[id]` was wired to the real knowledge graph (2026-07-24) and its
`id` segment is a **psp.cz person id** (`/poslanec/346`, `/poslanec/5226`).
The `lib/civic` sample MPs still carry slug ids (`novakova-p`, `hruska-k`),
so every `href={\`/poslanec/${mp.id}\`}` built from the mock — the `/dashboard`
leaderboard rows, the graph's person nodes, feed rows with an `mpId` — resolves
to a **404**. Verified against a production build on 2026-07-26.

**Why:** the links look correct in review and typecheck fine; the breakage only
shows on click. `/zebricek` is already on real data and links correctly, which
makes the dashboard's dead links easy to miss by comparison.

**How to apply:** don't treat a mock MP id as routable. Either keep mock-driven
surfaces link-free, or add a mock-slug → pspId mapping when the dashboard gets
ported to the real store (the remaining sample-data surfaces are `/dashboard`,
`/rozpocty` and the landing). Related: [[sample-data-first]].
