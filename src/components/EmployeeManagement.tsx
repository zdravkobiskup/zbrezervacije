import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import WorkingHoursEditor from "./WorkingHoursEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string;
  is_active: boolean;
  working_hours: Record<string, string> | null;
  group_id: string | null;
}

interface EmployeeGroup {
  id: string;
  name: string;
  working_hours: Record<string, string> | null;
}

interface EmployeeGroup {
  id: string;
  name: string;
  working_hours: Record<string, string>;
}

interface EmployeeManagementProps {
  businessId: string;
  groups?: EmployeeGroup[];
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

const DEFAULT_WORKING_HOURS = {
  monday: "09:00-17:00",
  tuesday: "09:00-17:00",
  wednesday: "09:00-17:00",
  thursday: "09:00-17:00",
  friday: "09:00-17:00",
  saturday: "closed",
  sunday: "closed"
};

const EmployeeManagement = ({ businessId, groups = [] }: EmployeeManagementProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [useCustomHours, setUseCustomHours] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    color: COLORS[0],
    group_id: "",
    working_hours: { ...DEFAULT_WORKING_HOURS } as Record<string, string>
  });

  useEffect(() => {
    loadEmployees();
  }, [businessId]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");

      if (error) throw error;
      setEmployees((data || []).map(emp => ({
        ...emp,
        working_hours: emp.working_hours as Record<string, string> | null,
        group_id: emp.group_id as string | null
      })));
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja zaposlenika");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const employeeData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        color: formData.color,
        group_id: formData.group_id || null,
        working_hours: useCustomHours ? formData.working_hours : null
      };

      if (editingId) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Zaposlenik ažuriran");
      } else {
        const { error } = await supabase
          .from("employees")
          .insert({
            business_id: businessId,
            ...employeeData
          });

        if (error) throw error;
        toast.success("Zaposlenik dodan");
      }

      resetForm();
      loadEmployees();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: "", 
      email: "", 
      phone: "", 
      color: COLORS[0], 
      group_id: "",
      working_hours: { ...DEFAULT_WORKING_HOURS }
    });
    setShowForm(false);
    setEditingId(null);
    setShowWorkingHours(false);
    setUseCustomHours(false);
  };

  const handleEdit = (employee: Employee) => {
    const hasCustomHours = employee.working_hours !== null;
    setFormData({
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      color: employee.color,
      group_id: employee.group_id || "",
      working_hours: employee.working_hours || { ...DEFAULT_WORKING_HOURS }
    });
    setEditingId(employee.id);
    setShowForm(true);
    setUseCustomHours(hasCustomHours);
    setShowWorkingHours(hasCustomHours);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Zaposlenik obrisan");
      loadEmployees();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const getEmployeeWorkingHoursSource = (employee: Employee) => {
    if (employee.working_hours) return "Individualno";
    if (employee.group_id) {
      const group = groups.find(g => g.id === employee.group_id);
      return group ? `Grupa: ${group.name}` : "Grupa";
    }
    return "Poslovna";
  };

  if (loading) {
    return <div className="text-center py-4">Učitavanje...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Zaposlenici</h3>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Dodaj zaposlenika
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Uredi zaposlenika" : "Novi zaposlenik"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Ime *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Boja u kalendaru</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          formData.color === color ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {groups.length > 0 && (
                <div className="space-y-2">
                  <Label>Grupa zaposlenika</Label>
                  <Select
                    value={formData.group_id}
                    onValueChange={(value) => setFormData({ ...formData, group_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bez grupe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bez grupe</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Zaposlenik će koristiti radno vrijeme grupe ako nema individualno postavljeno.
                  </p>
                </div>
              )}

              <Collapsible open={showWorkingHours} onOpenChange={setShowWorkingHours}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full gap-2">
                    <Clock className="w-4 h-4" />
                    Individualno radno vrijeme
                    {showWorkingHours ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useCustomHours"
                        checked={useCustomHours}
                        onChange={(e) => setUseCustomHours(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="useCustomHours" className="text-sm font-normal">
                        Koristi individualno radno vrijeme (nadjačava grupu i poslovne sate)
                      </Label>
                    </div>
                    {useCustomHours && (
                      <WorkingHoursEditor
                        workingHours={formData.working_hours}
                        onChange={(hours) => setFormData({ ...formData, working_hours: hours })}
                        compact
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex gap-2">
                <Button type="submit" className="gap-2">
                  <Check className="w-4 h-4" />
                  {editingId ? "Spremi" : "Dodaj"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} className="gap-2">
                  <X className="w-4 h-4" />
                  Odustani
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nemate još zaposlenika. Dodajte zaposlenike za upravljanje terminima.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <Card key={employee.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: employee.color }}
                    >
                      {employee.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      {employee.email && (
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {getEmployeeWorkingHoursSource(employee)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(employee)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(employee.id)}
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

export default EmployeeManagement;
