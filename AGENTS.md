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
- Built-in Visitor Display defaults live in `src/lib/display-config.ts`; saved settings are mapped onto them only by `resolveDisplayConfig` in `src/lib/live-display-config.ts` (via `useDisplayConfig`) — one repair/mapping path for `/`, `/kiosk` and the preview, and bad data always falls back to defaults.
- Operations pages live under the pathless `_ops` layout (ssr: false) and read data only via query options in `src/lib/ops-queries.ts`, which wrap service interfaces in `src/services/operations-service.ts` — swap adapters there, not in pages.
- Pure data logic (filtering, sorting, dwell stats, CSV) stays in `src/lib/ops-data.ts` so it is unit-tested; measured and estimated dwell are never blended.
- Settings sections live under `/_ops/settings/*`; config models are in `src/types/settings.ts`, pure validation/geometry/state-machine logic in `src/lib/settings-logic.ts` (unit-tested), and persistence behind `SettingsService` in `src/services/settings-service.ts` (exposed via `settingsQueries` in `ops-queries.ts`) — UI never touches storage directly.
- Camera passwords are write-only: the service never returns them and never writes them to browser storage — so a real secret store can replace the in-memory map without UI changes.
- Settings forms use `useSectionForm` (draft vs saved, Save/Cancel/reset-field, warning confirmation) plus `UnsavedChangesGuard` — so every section behaves the same.
- Camera previews may only appear on Settings → Debug Preview, started manually; a test asserts no `<video>` exists outside `IdleWindowVideo`.
- The Visitor Display preview runs in an iframe of `/display-preview` driven by same-origin postMessage; preview events and unsaved edits stay local and never reach `/` or `/kiosk`, which only read saved settings.
- Backend contracts the frontend expects are documented in `docs/backend-integration-readiness.md`; update it when a service interface or model changes.
