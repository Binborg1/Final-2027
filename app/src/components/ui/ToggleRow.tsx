/** A labelled on/off switch row. */
export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3">
      <span className="flex-1 text-body font-medium">{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-6 w-10 shrink-0 rounded-full bg-ink/25 transition-colors peer-checked:bg-sage peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-[3px] after:left-[3px] after:size-[18px] after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgb(58_36_20/0.25)] after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}
