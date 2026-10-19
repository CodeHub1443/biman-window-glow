<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Visitor events flow through `VisitorEventSource` (src/services); components never import mock data directly — so the real backend adapter can be swapped in.
- Visitor Display settings (idle video source, durations, headlines) live in `src/lib/display-config.ts` — one place to replace placeholders.
- Operations pages live under the pathless `_ops` layout (ssr: false) and read data only via query options in `src/lib/ops-queries.ts`, which wrap service interfaces in `src/services/operations-service.ts` — swap adapters there, not in pages.
- Pure data logic (filtering, sorting, dwell stats, CSV) stays in `src/lib/ops-data.ts` so it is unit-tested; measured and estimated dwell are never blended.
