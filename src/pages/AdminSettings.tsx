import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSettings, DbAppSettings } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { data: dbSettings, isLoading } = useAppSettings();
  const updateMutation = useUpdateSettings();
  const [settings, setSettings] = useState<Partial<DbAppSettings>>({});

  useEffect(() => {
    if (dbSettings) setSettings({ ...dbSettings });
  }, [dbSettings]);

  const update = <K extends keyof DbAppSettings>(key: K, value: DbAppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const { id, updated_at, ...rest } = settings as DbAppSettings;
      await updateMutation.mutateAsync(rest);
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure scheduling, thresholds, and processing behavior.</p>
      </div>

      <div className="space-y-6">
        <div className="panel space-y-4">
          <div className="panel-header">Scheduling</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Run Frequency</Label>
              <Select value={settings.run_frequency || "weekly"} onValueChange={v => update("run_frequency", v)}>
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
                <Select value={settings.weekly_run_day || "Monday"} onValueChange={v => update("weekly_run_day", v)}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Run Time (Local)</Label>
              <Input type="time" value={settings.run_time_local || "09:00"} onChange={e => update("run_time_local", e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Timezone</Label>
              <Input value={settings.timezone || ""} onChange={e => update("timezone", e.target.value)} className="bg-secondary" />
            </div>
          </div>
        </div>

        <div className="panel space-y-4">
          <div className="panel-header">Processing</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Batch Size</Label>
              <Input type="number" min={10} max={100} value={settings.batch_size ?? 25} onChange={e => update("batch_size", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Coverage Mode</Label>
              <Select value={settings.coverage_mode || "top_n"} onValueChange={v => update("coverage_mode", v)}>
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
                <Input type="number" min={50} max={1000} value={settings.top_n ?? 200} onChange={e => update("top_n", Number(e.target.value))} className="bg-secondary" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Max Companies per Run</Label>
              <Input type="number" min={1} max={1000} value={settings.max_companies_per_run ?? 250} onChange={e => update("max_companies_per_run", Number(e.target.value))} className="bg-secondary" />
            </div>
          </div>
        </div>

        <div className="panel space-y-4">
          <div className="panel-header">Thresholds & Lookback</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Snapshot Threshold (0–100)</Label>
              <Input type="number" min={0} max={100} value={settings.snapshot_threshold ?? 40} onChange={e => update("snapshot_threshold", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Snapshot Max Age (days)</Label>
              <Input type="number" min={1} value={settings.snapshot_max_age_days ?? 30} onChange={e => update("snapshot_max_age_days", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Jobs Lookback (days)</Label>
              <Input type="number" min={1} value={settings.jobs_lookback_days ?? 60} onChange={e => update("jobs_lookback_days", Number(e.target.value))} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">News Lookback (days)</Label>
              <Input type="number" min={1} value={settings.news_lookback_days ?? 90} onChange={e => update("news_lookback_days", Number(e.target.value))} className="bg-secondary" />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full gap-2">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
