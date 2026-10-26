import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, Euro } from "lucide-react";
import ServicePrices from "./ServicePrices";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  base_price: number | null;
  sale_price: number | null;
  lowest_price_30d: number | null;
  is_active: boolean;
}

interface ServiceManagementProps {
  businessId: string;
}

const ServiceManagement = ({ businessId }: ServiceManagementProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 30,
    price: 0,
    base_price: "" as string,
    sale_price: "" as string,
    lowest_price_30d: "" as string,
  });

  useEffect(() => {
    loadServices();
  }, [businessId]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja usluga");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = (v: string) => (v === "" ? null : parseFloat(v));
    const sale = num(formData.sale_price);
    if (sale !== null && formData.lowest_price_30d === "") {
      toast.error("Uz akcijsku cijenu unesite najnižu cijenu u zadnjih 30 dana");
      return;
    }
    const payload = {
      ...formData,
      base_price: num(formData.base_price),
      sale_price: sale,
      lowest_price_30d: sale === null ? null : num(formData.lowest_price_30d),
    };
    setLoading(true);

    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id);

        if (error) throw error;
        toast.success("Usluga je ažurirana!");
      } else {
        const { error } = await supabase
          .from("services")
          .insert([{ ...payload, business_id: businessId }]);

        if (error) throw error;
        toast.success("Usluga je dodana!");
      }

      setDialogOpen(false);
      resetForm();
      loadServices();
    } catch (error: any) {
      toast.error(error.message || "Greška prilikom spremanja");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Jeste li sigurni da želite obrisati ovu uslugu?")) return;

    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Usluga je obrisana!");
      loadServices();
    } catch (error: any) {
      toast.error("Greška prilikom brisanja");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      duration_minutes: 30,
      price: 0,
    });
    setEditingService(null);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      duration_minutes: service.duration_minutes,
      price: service.price,
      base_price: service.base_price?.toString() ?? "",
      sale_price: service.sale_price?.toString() ?? "",
      lowest_price_30d: service.lowest_price_30d?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Usluge</h3>
          <p className="text-sm text-muted-foreground">Upravljajte uslugama koje nudite</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Dodaj uslugu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? "Uredi uslugu" : "Nova usluga"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Naziv usluge *</Label>
                <Input
                  id="service-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-description">Opis</Label>
                <Textarea
                  id="service-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Trajanje (min) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="15"
                    step="15"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Trenutna cijena (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_price">Bazna cijena na 10.09.2026. (€)</Label>
                  <Input id="base_price" type="number" min="0" step="0.01" value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale_price">Akcijska cijena (€)</Label>
                  <Input id="sale_price" type="number" min="0" step="0.01" value={formData.sale_price}
                    placeholder="Nema akcije"
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} />
                </div>
              </div>
              {formData.sale_price !== "" && (
                <div className="space-y-2">
                  <Label htmlFor="lowest">Najniža cijena u zadnjih 30 dana (€) *</Label>
                  <Input id="lowest" type="number" min="0" step="0.01" value={formData.lowest_price_30d}
                    onChange={(e) => setFormData({ ...formData, lowest_price_30d: e.target.value })} required />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Spremanje..." : editingService ? "Ažuriraj" : "Dodaj"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Još nema dodanih usluga</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="shadow-soft hover:shadow-medium transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    {service.description && (
                      <CardDescription className="mt-2 line-clamp-2">
                        {service.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={service.is_active ? "default" : "secondary"}>
                    {service.is_active ? "Aktivno" : "Neaktivno"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{service.duration_minutes} min</span>
                  </div>
                  <ServicePrices {...service} />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(service)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;
