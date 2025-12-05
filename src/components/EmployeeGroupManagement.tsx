import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import WorkingHoursEditor from "./WorkingHoursEditor";

interface EmployeeGroup {
  id: string;
  name: string;
  working_hours: Record<string, string> | null;
}

interface EmployeeGroupManagementProps {
  businessId: string;
  onGroupsChange?: () => void;
}

const DEFAULT_WORKING_HOURS = {
  monday: "09:00-17:00",
  tuesday: "09:00-17:00",
  wednesday: "09:00-17:00",
  thursday: "09:00-17:00",
  friday: "09:00-17:00",
  saturday: "closed",
  sunday: "closed"
};

const EmployeeGroupManagement = ({ businessId, onGroupsChange }: EmployeeGroupManagementProps) => {
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    working_hours: Record<string, string>;
  }>({
    name: "",
    working_hours: { ...DEFAULT_WORKING_HOURS }
  });

  useEffect(() => {
    loadGroups();
  }, [businessId]);

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_groups")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");

      if (error) throw error;
      setGroups((data || []).map(g => ({
        ...g,
        working_hours: g.working_hours as Record<string, string> | null
      })));
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja grupa");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from("employee_groups")
          .update({
            name: formData.name,
            working_hours: formData.working_hours
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Grupa ažurirana");
      } else {
        const { error } = await supabase
          .from("employee_groups")
          .insert({
            business_id: businessId,
            name: formData.name,
            working_hours: formData.working_hours
          });

        if (error) throw error;
        toast.success("Grupa dodana");
      }

      setFormData({ name: "", working_hours: { ...DEFAULT_WORKING_HOURS } });
      setShowForm(false);
      setEditingId(null);
      loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const handleEdit = (group: EmployeeGroup) => {
    setFormData({
      name: group.name,
      working_hours: (group.working_hours as Record<string, string>) || { ...DEFAULT_WORKING_HOURS }
    });
    setEditingId(group.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("employee_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Grupa obrisana");
      loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", working_hours: { ...DEFAULT_WORKING_HOURS } });
    setShowForm(false);
    setEditingId(null);
  };

  const formatWorkingHours = (hours: Record<string, string> | null) => {
    if (!hours) return "Nije postavljeno";
    
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const dayNames: Record<string, string> = {
      monday: "Pon",
      tuesday: "Uto",
      wednesday: "Sri",
      thursday: "Čet",
      friday: "Pet",
      saturday: "Sub",
      sunday: "Ned"
    };
    
    const workDays = days.filter(day => hours[day] !== "closed");
    if (workDays.length === 0) return "Zatvoreno";
    
    const firstHours = hours[workDays[0]];
    const allSame = workDays.every(day => hours[day] === firstHours);
    
    if (allSame && workDays.length === 5 && !workDays.includes("saturday") && !workDays.includes("sunday")) {
      return `Pon-Pet: ${firstHours}`;
    }
    
    return workDays.map(day => `${dayNames[day]}: ${hours[day]}`).slice(0, 3).join(", ") + (workDays.length > 3 ? "..." : "");
  };

  if (loading) {
    return <div className="text-center py-4">Učitavanje...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Grupe zaposlenika
        </h3>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Dodaj grupu
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Uredi grupu" : "Nova grupa"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Naziv grupe *</Label>
                <Input
                  id="groupName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="npr. Frizeri, Kozmetičari"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Radno vrijeme grupe
                </Label>
                <WorkingHoursEditor
                  workingHours={formData.working_hours}
                  onChange={(hours) => setFormData({ ...formData, working_hours: hours })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="gap-2">
                  <Check className="w-4 h-4" />
                  {editingId ? "Spremi" : "Dodaj"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} className="gap-2">
                  <X className="w-4 h-4" />
                  Odustani
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nemate još grupa. Grupe omogućuju zajedničko radno vrijeme za više zaposlenika.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      {group.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatWorkingHours(group.working_hours)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(group)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(group.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeGroupManagement;
