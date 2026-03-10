import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

interface Material {
  id: string;
  name: string;
  unit: string;
  current_quantity: number;
  min_quantity: number;
  price_per_unit: number;
}

interface Service {
  id: string;
  name: string;
}

interface ServiceMaterial {
  id: string;
  service_id: string;
  material_id: string;
  quantity_needed: number;
}

interface ServiceNormativesProps {
  businessId: string;
  materials: Material[];
}

const ServiceNormatives = ({ businessId, materials }: ServiceNormativesProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [normatives, setNormatives] = useState<ServiceMaterial[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [newMaterialId, setNewMaterialId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, [businessId]);

  useEffect(() => {
    if (selectedService) loadNormatives();
  }, [selectedService]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setServices(data || []);
      if (data && data.length > 0) setSelectedService(data[0].id);
    } catch (error) {
      toast.error("Greška prilikom učitavanja usluga");
    } finally {
      setLoading(false);
    }
  };

  const loadNormatives = async () => {
    try {
      const { data, error } = await supabase
        .from("service_materials")
        .select("*")
        .eq("service_id", selectedService);
      if (error) throw error;
      setNormatives(data || []);
    } catch (error) {
      toast.error("Greška prilikom učitavanja normativa");
    }
  };

  const handleAdd = async () => {
    if (!newMaterialId || !newQuantity || !selectedService) {
      toast.error("Odaberite materijal i unesite količinu");
      return;
    }

    const qty = parseFloat(newQuantity);
    if (qty <= 0) {
      toast.error("Količina mora biti pozitivna");
      return;
    }

    try {
      const { error } = await supabase
        .from("service_materials")
        .insert({
          service_id: selectedService,
          material_id: newMaterialId,
          quantity_needed: qty,
        });
      if (error) {
        if (error.code === "23505") {
          toast.error("Taj materijal je već dodan za ovu uslugu");
          return;
        }
        throw error;
      }
      toast.success("Normativ dodan");
      setNewMaterialId("");
      setNewQuantity("");
      loadNormatives();
    } catch (error) {
      toast.error("Greška prilikom dodavanja");
    }
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from("service_materials")
        .update({ quantity_needed: quantity })
        .eq("id", id);
      if (error) throw error;
      toast.success("Normativ ažuriran");
    } catch (error) {
      toast.error("Greška prilikom ažuriranja");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("service_materials").delete().eq("id", id);
      if (error) throw error;
      toast.success("Normativ obrisan");
      loadNormatives();
    } catch (error) {
      toast.error("Greška prilikom brisanja");
    }
  };

  const getMaterial = (id: string) => materials.find(m => m.id === id);
  const availableMaterials = materials.filter(m => !normatives.some(n => n.material_id === m.id));

  if (loading) return <div className="text-center py-4">Učitavanje...</div>;

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          Najprije dodajte usluge kako biste mogli postaviti normative.
        </CardContent>
      </Card>
    );
  }

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          Najprije dodajte materijale u skladište kako biste mogli postaviti normative.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Normativi po usluzi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Odaberite uslugu</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger><SelectValue placeholder="Odaberite uslugu" /></SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {normatives.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Materijali za ovu uslugu:</Label>
              {normatives.map(n => {
                const mat = getMaterial(n.material_id);
                return (
                  <div key={n.id} className="flex items-center gap-2 p-2 rounded-md border">
                    <span className="flex-1 text-sm font-medium">{mat?.name || "?"}</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      defaultValue={n.quantity_needed}
                      onBlur={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 0 && val !== n.quantity_needed) handleUpdateQuantity(n.id, val);
                      }}
                    />
                    <span className="text-sm text-muted-foreground w-10">{mat?.unit}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(n.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {availableMaterials.length > 0 && (
            <div className="flex gap-2 items-end pt-2 border-t">
              <div className="flex-1">
                <Label>Materijal</Label>
                <Select value={newMaterialId} onValueChange={setNewMaterialId}>
                  <SelectTrigger><SelectValue placeholder="Odaberite" /></SelectTrigger>
                  <SelectContent>
                    {availableMaterials.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label>Količina</Label>
                <Input type="number" step="0.01" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} />
              </div>
              <Button onClick={handleAdd} size="sm" className="gap-1">
                <Plus className="w-4 h-4" />Dodaj
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceNormatives;
