"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "cn";
import { Slider } from "@/components/ui/slider";
import type { ReaderFont, ThemePreference } from "@/lib/generated/prisma/enums";
import type { Preferences } from "@/lib/types";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex overflow-hidden rounded-sm border border-border bg-background">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center gap-[7px] px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-terracotta/14 aria-checked:font-semibold aria-checked:text-terracotta-text pointer-coarse:min-h-12 [&_svg]:size-[15px]",
            index > 0 && "border-l border-border",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Control({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px] grid gap-[9px] last:mb-0">
      <div className="flex justify-between text-[12.5px] text-muted-foreground">
        <span>{label}</span>
        {value && <b className="font-mono text-[11.5px] font-medium text-foreground">{value}</b>}
      </div>
      {children}
    </div>
  );
}

export function DisplayControls({
  preferences,
  onChange,
  showWidth = true,
  showTheme = true,
}: {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  showWidth?: boolean;
  showTheme?: boolean;
}) {
  return (
    <div>
      <Control label="Typeface">
        <Segmented<ReaderFont>
          label="Typeface"
          value={preferences.font}
          onChange={(font) => onChange({ font })}
          options={[
            { value: "SERIF", label: "Newsreader" },
            { value: "SANS", label: "Grotesk" },
          ]}
        />
      </Control>
      <Control label="Text size" value={`${preferences.fontSize}px`}>
        <Slider
          min={15}
          max={26}
          step={1}
          value={[preferences.fontSize]}
          onValueChange={([value]) => value !== undefined && onChange({ fontSize: value })}
          aria-label="Text size"
        />
      </Control>
      <Control label="Line spacing" value={preferences.lineHeight.toFixed(2)}>
        <Slider
          min={1.4}
          max={2.1}
          step={0.02}
          value={[preferences.lineHeight]}
          onValueChange={([value]) => value !== undefined && onChange({ lineHeight: Math.round(value * 100) / 100 })}
          aria-label="Line spacing"
        />
      </Control>
      {showWidth && (
        <Control label="Column width" value={`${preferences.columnWidth}ch`}>
          <Slider
            min={48}
            max={86}
            step={1}
            value={[preferences.columnWidth]}
            onValueChange={([value]) => value !== undefined && onChange({ columnWidth: value })}
            aria-label="Column width"
          />
        </Control>
      )}
      {showTheme && (
        <Control label="Theme">
          <Segmented<ThemePreference>
            label="Theme"
            value={preferences.theme}
            onChange={(theme) => onChange({ theme })}
            options={[
              { value: "LIGHT", label: "Ivory", icon: <Sun aria-hidden /> },
              { value: "DARK", label: "Charcoal", icon: <Moon aria-hidden /> },
              { value: "SYSTEM", label: "System", icon: <Monitor aria-hidden /> },
            ]}
          />
        </Control>
      )}
    </div>
  );
}
