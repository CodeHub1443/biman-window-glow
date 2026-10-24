import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { clone, deepEqual, getAt, setAt } from "@/lib/settings-logic";
import { SettingsValidationError } from "@/services/settings-service";
import type { FieldErrors, ValidationResult } from "@/types/settings";

export type SaveStatus = "saved" | "dirty" | "invalid" | "saving" | "error";

export interface SectionForm<T> {
  draft: T;
  saved: T;
  dirty: boolean;
  status: SaveStatus;
  errors: FieldErrors;
  warnings: string[];
  /** Errors are revealed after a save attempt, or per field once it has been edited. */
  errorFor(path: string): string | undefined;
  isFieldDirty(path: string): boolean;
  set(path: string, value: unknown): void;
  update(fn: (d: T) => T): void;
  resetField(path: string): void;
  cancel(): void;
  /** Validates, asks for confirmation on warnings (via the returned flag), then saves. */
  submit(opts?: { confirmed?: boolean }): Promise<"saved" | "invalid" | "needs-confirm" | "failed">;
  lastError: string | null;
}

/**
 * Draft/saved form state for one settings section. The saved value comes from TanStack Query;
 * the draft is local until Save. Cancel restores the saved value; resetField restores one field.
 */
export function useSectionForm<T>(opts: {
  saved: T;
  validate: (v: T) => ValidationResult;
  save: (v: T) => Promise<T>;
  label: string;
  onSaved?: (v: T) => void;
}): SectionForm<T> {
  const { saved, validate, save, label, onSaved } = opts;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<T>(() => clone(saved));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [lastError, setLastError] = useState<string | null>(null);
  const savedRef = useRef(saved);

  // When the saved value changes (after save or refetch), adopt it if the user has no pending edits.
  useEffect(() => {
    const prev = savedRef.current;
    savedRef.current = saved;
    setDraft((d) => (deepEqual(d, prev) ? clone(saved) : d));
  }, [saved]);

  const dirty = !deepEqual(draft, saved);
  const result = useMemo(() => validate(draft), [draft, validate]);
  const errors = useMemo(() => ({ ...result.errors, ...serverErrors }), [result.errors, serverErrors]);

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      setDraft(clone(v));
      savedRef.current = v;
      setAttempted(false);
      setTouched(new Set());
      setLastError(null);
      toast.success(`${label} saved`, { description: "Stored in this browser (demo). No device was changed." });
      onSaved?.(v);
    },
    onError: (e) => {
      if (e instanceof SettingsValidationError) setServerErrors(e.errors);
      setLastError(e.message);
      toast.error(`${label} not saved`, { description: e.message });
    },
  });

  const set = useCallback((path: string, value: unknown) => {
    setDraft((d) => setAt(d, path, value));
    setTouched((t) => new Set(t).add(path));
    setServerErrors({});
  }, []);
  const update = useCallback((fn: (d: T) => T) => {
    setDraft((d) => fn(clone(d)));
    setServerErrors({});
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const status: SaveStatus = mutation.isPending ? "saving" : lastError && dirty ? "error" : dirty && hasErrors && attempted ? "invalid" : dirty ? "dirty" : "saved";

  return {
    draft,
    saved,
    dirty,
    status,
    errors,
    warnings: result.warnings,
    lastError,
    errorFor: (path) => (attempted || touched.has(path) ? errors[path] : undefined),
    isFieldDirty: (path) => !deepEqual(getAt(draft, path), getAt(saved, path)),
    set,
    update,
    resetField: (path) => {
      setDraft((d) => setAt(d, path, clone(getAt(saved, path))));
      setServerErrors({});
    },
    cancel: () => {
      setDraft(clone(saved));
      setTouched(new Set());
      setAttempted(false);
      setServerErrors({});
      setLastError(null);
    },
    async submit({ confirmed = false } = {}) {
      setAttempted(true);
      if (Object.keys(result.errors).length) {
        toast.error("Fix the highlighted fields", { description: Object.values(result.errors)[0] });
        return "invalid";
      }
      if (result.warnings.length && !confirmed) return "needs-confirm";
      try {
        await mutation.mutateAsync(draft);
        return "saved";
      } catch {
        return "failed";
      }
    },
  };
}
