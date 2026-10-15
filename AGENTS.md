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
