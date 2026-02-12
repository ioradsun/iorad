import { useState } from "react";
import { mockSettings } from "@/data/mockData";
import { AppSettings, RunFrequency, CoverageMode, WeekDay } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const [settings, setSettings] = useState<AppSettings>({ ...mockSettings });

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast.success("Settings saved");
  };

  const days: WeekDay[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure scheduling, thresholds, and processing behavior.</p>
      </div>

      <div className="space-y-6">
        {/* Scheduling */}
        <div className="panel space-y-4">
          <div className="panel-header">Scheduling</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Run Frequency</Label>
              <Select value={settings.run_frequency} onValueChange={v => update("run_frequency", v as RunFrequency)}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.run_frequency === "weekly" && (
              <div className="space-y-2">
                <Label className="text-xs">Day of Week</Label>
                <Select value={settings.weekly_run_day} onValueChange={v => update("weekly_run_day", v as WeekDay)}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Run Time (Local)</Label>
              <Input type="time" value={settings.run_time_local} onChange={e => update("run_time_local", e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Timezone</Label>
              <Input value={settings.timezone} onChange={e => update("timezone", e.target.value)} className="bg-secondary" />
            </div>
          </div>
        </div>

        {/* Processing */}
        <div className="panel space-y-4">
          <div className="panel-header">Processing</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Batch Size</Label>
              <Input type="number" min={10} max={100} value={settings.batch_size} onChange={e => update("batch_size", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Coverage Mode</Label>
              <Select value={settings.coverage_mode} onValueChange={v => update("coverage_mode", v as CoverageMode)}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  <SelectItem value="top_n">Top N by Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.coverage_mode === "top_n" && (
              <div className="space-y-2">
                <Label className="text-xs">Top N Value</Label>
                <Input type="number" min={50} max={1000} value={settings.top_n} onChange={e => update("top_n", Number(e.target.value))} className="bg-secondary" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Max Companies per Run</Label>
              <Input type="number" min={1} max={1000} value={settings.max_companies_per_run} onChange={e => update("max_companies_per_run", Number(e.target.value))} className="bg-secondary" />
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="panel space-y-4">
          <div className="panel-header">Thresholds & Lookback</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Snapshot Threshold (0–100)</Label>
              <Input type="number" min={0} max={100} value={settings.snapshot_threshold} onChange={e => update("snapshot_threshold", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Snapshot Max Age (days)</Label>
              <Input type="number" min={1} value={settings.snapshot_max_age_days} onChange={e => update("snapshot_max_age_days", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Jobs Lookback (days)</Label>
              <Input type="number" min={1} value={settings.jobs_lookback_days} onChange={e => update("jobs_lookback_days", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">News Lookback (days)</Label>
              <Input type="number" min={1} value={settings.news_lookback_days} onChange={e => update("news_lookback_days", Number(e.target.value))} className="bg-secondary" />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full gap-2">
          <Save className="w-4 h-4" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
