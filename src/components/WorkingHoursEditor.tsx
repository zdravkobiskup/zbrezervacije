import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface WorkingHoursEditorProps {
  workingHours: Record<string, string>;
  onChange: (hours: Record<string, string>) => void;
  compact?: boolean;
}

const DAYS = [
  { key: "monday", label: "Ponedjeljak", short: "Pon" },
  { key: "tuesday", label: "Utorak", short: "Uto" },
  { key: "wednesday", label: "Srijeda", short: "Sri" },
  { key: "thursday", label: "Četvrtak", short: "Čet" },
  { key: "friday", label: "Petak", short: "Pet" },
  { key: "saturday", label: "Subota", short: "Sub" },
  { key: "sunday", label: "Nedjelja", short: "Ned" }
];

const WorkingHoursEditor = ({ workingHours, onChange, compact = false }: WorkingHoursEditorProps) => {
  const parseTime = (value: string) => {
    if (value === "closed") return { isOpen: false, start: "09:00", end: "17:00" };
    const [start, end] = value.split("-");
    return { isOpen: true, start: start || "09:00", end: end || "17:00" };
  };

  const handleToggle = (day: string, isOpen: boolean) => {
    const current = parseTime(workingHours[day] || "closed");
    onChange({
      ...workingHours,
      [day]: isOpen ? `${current.start}-${current.end}` : "closed"
    });
  };

  const handleTimeChange = (day: string, type: "start" | "end", value: string) => {
    const current = parseTime(workingHours[day] || "09:00-17:00");
    const newTime = type === "start" 
      ? `${value}-${current.end}` 
      : `${current.start}-${value}`;
    onChange({
      ...workingHours,
      [day]: newTime
    });
  };

  return (
    <div className={`space-y-3 ${compact ? "" : "bg-muted/50 rounded-lg p-4"}`}>
      {DAYS.map((day) => {
        const parsed = parseTime(workingHours[day.key] || "closed");
        return (
          <div key={day.key} className="flex items-center gap-3">
            <div className={`${compact ? "w-12" : "w-24"} font-medium text-sm`}>
              {compact ? day.short : day.label}
            </div>
            <Switch
              checked={parsed.isOpen}
              onCheckedChange={(checked) => handleToggle(day.key, checked)}
            />
            {parsed.isOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={parsed.start}
                  onChange={(e) => handleTimeChange(day.key, "start", e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={parsed.end}
                  onChange={(e) => handleTimeChange(day.key, "end", e.target.value)}
                  className="w-28"
                />
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">Zatvoreno</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkingHoursEditor;
