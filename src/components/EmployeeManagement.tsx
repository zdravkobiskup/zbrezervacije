import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string;
  is_active: boolean;
}

interface EmployeeManagementProps {
  businessId: string;
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

const EmployeeManagement = ({ businessId }: EmployeeManagementProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    color: COLORS[0]
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
      setEmployees(data || []);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja zaposlenika");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from("employees")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            color: formData.color
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Zaposlenik ažuriran");
      } else {
        const { error } = await supabase
          .from("employees")
          .insert({
            business_id: businessId,
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            color: formData.color
          });

        if (error) throw error;
        toast.success("Zaposlenik dodan");
      }

      setFormData({ name: "", email: "", phone: "", color: COLORS[0] });
      setShowForm(false);
      setEditingId(null);
      loadEmployees();
    } catch (error: any) {
      toast.error("Greška: " + error.message);
    }
  };

  const handleEdit = (employee: Employee) => {
    setFormData({
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      color: employee.color
    });
    setEditingId(employee.id);
    setShowForm(true);
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

  const handleCancel = () => {
    setFormData({ name: "", email: "", phone: "", color: COLORS[0] });
    setShowForm(false);
    setEditingId(null);
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
