import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PageError, PageSkeleton, Panel } from "@/components/ops/ui";
import { NumberField, SaveBar, SelectField, TextField, ToggleField, WarningList } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useTheme } from "@/components/ThemeProvider";
import { useSectionForm } from "@/hooks/use-section-form";
import { settingsQueries, settingsService } from "@/lib/ops-queries";
import { validateGeneral } from "@/lib/settings-logic";

export const Route = createFileRoute("/_ops/settings/general")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueries.general()).then(() => undefined),
  head: () => settingsHead("General", "System name, station labels, time zone, theme, greeting duration and data retention."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: GeneralPage,
});

const TIME_ZONES = ["Asia/Dhaka", "UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London"];

function GeneralPage() {
  const { data } = useSuspenseQuery(settingsQueries.general());
  const { data: meta } = useQuery(settingsQueries.meta());
  const { setTheme } = useTheme();
  const form = useSectionForm({ saved: data, validate: validateGeneral, save: settingsService.saveGeneral, label: "General settings", onSaved: (v) => setTheme(v.theme) });
  const sample = new Date();
  const fmtSample = (() => {
    const tz = form.draft.timeZone;
    const opts: Intl.DateTimeFormatOptions = { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: form.draft.timeFormat === "12h" };
    const time = sample.toLocaleTimeString("en-GB", opts);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(sample).map((p) => [p.type, p.value]));
    const mon = sample.toLocaleString("en-GB", { timeZone: tz, month: "short" });
    const date = form.draft.dateFormat === "yyyy-MM-dd" ? `${parts["year"]}-${parts["month"]}-${parts["day"]}` : form.draft.dateFormat === "dd/MM/yyyy" ? `${parts["day"]}/${parts["month"]}/${parts["year"]}` : `${parts["day"]} ${mon} ${parts["year"]}`;
    return `${date} ${time}`;
  })();

  return (
    <div className="space-y-5">
      <Panel title="System">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField form={form} path="systemName" label="System name" hint="Shown in reports and the operations header." />
        </div>
      </Panel>

      <Panel title="Stations" meta={<span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">2 planned stations</span>}>
        <div className="grid gap-4 md:grid-cols-2">
          {form.draft.stations.map((s, i) => (
            <TextField key={s.id} form={form} path={`stations.${i}.label`} label={`${s.id} label`} demo hint="Replace with the real station name when confirmed." />
          ))}
        </div>
      </Panel>

      <Panel title="Date & time">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField form={form} path="timeZone" label="Time zone" options={TIME_ZONES.map((z) => ({ value: z, label: z }))} />
          <SelectField form={form} path="dateFormat" label="Date format" options={[
            { value: "yyyy-MM-dd", label: "2026-10-20" }, { value: "dd/MM/yyyy", label: "20/10/2026" }, { value: "dd MMM yyyy", label: "20 Oct 2026" },
          ]} />
          <SelectField form={form} path="timeFormat" label="Time format" options={[{ value: "24h", label: "24-hour" }, { value: "12h", label: "12-hour" }]} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">Preview: <span className="text-foreground">{fmtSample}</span></p>
      </Panel>

      <Panel title="Appearance & greeting">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField form={form} path="theme" label="Default theme" hint="Applied to the operations screens when saved." options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
          <NumberField form={form} path="greetingDurationSec" label="Greeting display duration" unit="seconds" min={3} max={30} hint="Shared with Visitor Display and Detection settings." />
        </div>
      </Panel>

      <Panel title="Event history & retention" meta={<span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">applied when backend supports it</span>}>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField form={form} path="retention.eventDays" label="Keep visitor events" unit="days" min={1} max={3650} />
          <NumberField form={form} path="retention.faceImageDays" label="Keep face images" unit="days" min={1} max={3650} hint="Cannot exceed event retention." />
          <NumberField form={form} path="retention.auditDays" label="Keep audit log" unit="days" min={30} max={3650} />
        </div>
        <div className="mt-4 max-w-xl"><ToggleField form={form} path="retention.autoPurge" label="Automatically purge expired data" hint="Nothing is deleted in this prototype." /></div>
      </Panel>

      <WarningList warnings={form.dirty ? form.warnings : []} />
      <SaveBar form={form} savedAt={meta?.lastSavedAt.general} />
    </div>
  );
}
