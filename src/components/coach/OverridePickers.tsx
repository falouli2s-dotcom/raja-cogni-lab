import { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  STIMULI_GROUPS,
  PREDEFINED_STIMULI,
  PREDEFINED_DISTANCES,
  type DistancesOverride,
} from "@/lib/exercise-overrides";

/* =============== Stimuli picker =============== */

export function StimuliPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const selected = new Set(value);

  function toggle(item: string) {
    if (selected.has(item)) onChange(value.filter((v) => v !== item));
    else onChange([...value, item]);
  }

  function addCustom() {
    const v = custom.trim();
    if (!v) return;
    if (!selected.has(v)) onChange([...value, v]);
    setCustom("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  }

  return (
    <div className="space-y-2">
      {STIMULI_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1">
            {group.items.map((item) => {
              const on = selected.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggle(item)}
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors " +
                    (on
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground")
                  }
                >
                  {item}
                  {on && <X className="h-2.5 w-2.5" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {value.some((v) => !PREDEFINED_STIMULI.has(v)) && (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Personnalisés
          </p>
          <div className="flex flex-wrap gap-1">
            {value
              .filter((v) => !PREDEFINED_STIMULI.has(v))
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggle(item)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/60 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {item}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ajouter un stimulus personnalisé…"
          className="h-7 flex-1 text-[11px]"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground hover:border-primary/40 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      </div>
    </div>
  );
}

/* =============== Distance picker =============== */

const UNITS = ["m", "cm", "km"] as const;
type Unit = (typeof UNITS)[number];

function parseCustom(distance: string | null): {
  isPredefined: boolean;
  num: string;
  unit: Unit;
} {
  if (!distance) return { isPredefined: false, num: "", unit: "m" };
  if (PREDEFINED_DISTANCES.includes(distance))
    return { isPredefined: true, num: "", unit: "m" };
  const m = distance.match(/^(\d+(?:[.,]\d+)?)\s*(m|cm|km)?$/i);
  if (m) {
    const unit = (m[2]?.toLowerCase() as Unit) ?? "m";
    return { isPredefined: false, num: m[1], unit };
  }
  return { isPredefined: false, num: distance, unit: "m" };
}

function parseGrid(grid: string | null): { w: string; h: string } {
  if (!grid) return { w: "", h: "" };
  const m = grid.match(/^(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/i);
  if (m) return { w: m[1], h: m[2] };
  return { w: "", h: "" };
}

export function DistancePicker({
  value,
  onChange,
}: {
  value: DistancesOverride | null;
  onChange: (next: DistancesOverride | null) => void;
}) {
  const distance = value?.distance ?? null;
  const grid = value?.grid ?? null;
  const parsed = parseCustom(distance);
  const [customNum, setCustomNum] = useState(parsed.num);
  const [customUnit, setCustomUnit] = useState<Unit>(parsed.unit);
  const [showGrid, setShowGrid] = useState(!!grid);
  const initialGrid = parseGrid(grid);
  const [gridW, setGridW] = useState(initialGrid.w);
  const [gridH, setGridH] = useState(initialGrid.h);

  function emit(next: { distance: string | null; grid: string | null }) {
    if (!next.distance && !next.grid) onChange(null);
    else onChange(next);
  }

  function selectChip(chip: string) {
    setCustomNum("");
    if (distance === chip) emit({ distance: null, grid });
    else emit({ distance: chip, grid });
  }

  function onCustomNum(v: string) {
    setCustomNum(v);
    if (v.trim() === "") {
      // Don't auto-clear chip selection unless chip wasn't set
      if (!distance || !PREDEFINED_DISTANCES.includes(distance))
        emit({ distance: null, grid });
      return;
    }
    emit({ distance: `${v.trim()}${customUnit}`, grid });
  }

  function onCustomUnit(u: Unit) {
    setCustomUnit(u);
    if (customNum.trim() !== "")
      emit({ distance: `${customNum.trim()}${u}`, grid });
  }

  function onGridChange(w: string, h: string) {
    setGridW(w);
    setGridH(h);
    if (w.trim() && h.trim())
      emit({ distance, grid: `${w.trim()} × ${h.trim()} m` });
    else emit({ distance, grid: null });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {PREDEFINED_DISTANCES.map((d) => {
          const on = distance === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => selectChip(d)}
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors " +
                (on
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground")
              }
            >
              {d}
              {on && <X className="h-2.5 w-2.5" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="decimal"
          value={customNum}
          onChange={(e) => onCustomNum(e.target.value)}
          placeholder="Autre distance…"
          className="h-7 flex-1 text-[11px]"
        />
        <select
          value={customUnit}
          onChange={(e) => onCustomUnit(e.target.value as Unit)}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {!showGrid ? (
        <button
          type="button"
          onClick={() => setShowGrid(true)}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
        >
          <Plus className="h-3 w-3" /> Ajouter dimensions de grille
        </button>
      ) : (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Surface / Grille (m)
          </p>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              value={gridW}
              onChange={(e) => onGridChange(e.target.value, gridH)}
              placeholder="L"
              className="h-7 w-16 text-[11px]"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="number"
              inputMode="decimal"
              value={gridH}
              onChange={(e) => onGridChange(gridW, e.target.value)}
              placeholder="H"
              className="h-7 w-16 text-[11px]"
            />
            <span className="text-[11px] text-muted-foreground">m</span>
            <button
              type="button"
              onClick={() => {
                setShowGrid(false);
                onGridChange("", "");
              }}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
            >
              Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
