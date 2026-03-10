import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, AlertTriangle, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServiceNormatives from "./ServiceNormatives";
import InventoryReport from "./InventoryReport";

interface Material {
  id: string;
  name: string;
  unit: string;
  current_quantity: number;
  min_quantity: number;
  price_per_unit: number;
}

interface InventoryManagementProps {
  businessId: string;
}

const UNITS = ["kom", "kg", "g", "l", "ml", "m", "cm", "pak"];

const InventoryManagement = ({ businessId }: InventoryManagementProps) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedMaterialForStock, setSelectedMaterialForStock] = useState<Material | null>(null);
  const [addQuantity, setAddQuantity] = useState("");
  const [form, setForm] = useState({
    name: "",
    unit: "kom",
    current_quantity: "",
    min_quantity: "",
    price_per_unit: "",
  });

  useEffect(() => {
    loadMaterials();
  }, [businessId]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("business_id", businessId)
        .order("name");

      if (error) throw error;
      setMaterials(data || []);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja materijala");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Unesite naziv materijala");
      return;
    }

    try {
      const materialData = {
        business_id: businessId,
        name: form.name.trim(),
        unit: form.unit,
        current_quantity: parseFloat(form.current_quantity) || 0,
        min_quantity: parseFloat(form.min_quantity) || 0,
        price_per_unit: parseFloat(form.price_per_unit) || 0,
      };

      if (editingMaterial) {
        const { error } = await supabase
          .from("materials")
          .update(materialData)
          .eq("id", editingMaterial.id);
        if (error) throw error;
        toast.success("Materijal ažuriran");
      } else {
        const { error } = await supabase
          .from("materials")
          .insert(materialData);
        if (error) throw error;
        toast.success("Materijal dodan");
      }

      resetForm();
      loadMaterials();
    } catch (error: any) {
      toast.error("Greška prilikom spremanja");
    }
  };

  const handleAddStock = async () => {
    if (!selectedMaterialForStock || !addQuantity) return;
    const qty = parseFloat(addQuantity);
    if (qty <= 0) {
      toast.error("Unesite pozitivnu količinu");
      return;
    }

    try {
      // Insert transaction
      const { error: txError } = await supabase
        .from("material_transactions")
        .insert({
          material_id: selectedMaterialForStock.id,
          quantity_change: qty,
          type: "restock",
          notes: "Ručno dodavanje zaliha",
        });
      if (txError) throw txError;

      // Update quantity
      const { error } = await supabase
        .from("materials")
        .update({
          current_quantity: selectedMaterialForStock.current_quantity + qty,
        })
        .eq("id", selectedMaterialForStock.id);
      if (error) throw error;

      toast.success(`Dodano ${qty} ${selectedMaterialForStock.unit} za ${selectedMaterialForStock.name}`);
      setAddStockOpen(false);
      setSelectedMaterialForStock(null);
      setAddQuantity("");
      loadMaterials();
    } catch (error: any) {
      toast.error("Greška prilikom dodavanja zaliha");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj materijal?")) return;

    try {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
      toast.success("Materijal obrisan");
      loadMaterials();
    } catch (error: any) {
      toast.error("Greška prilikom brisanja");
    }
  };

  const resetForm = () => {
    setForm({ name: "", unit: "kom", current_quantity: "", min_quantity: "", price_per_unit: "" });
    setEditingMaterial(null);
    setDialogOpen(false);
  };

  const openEdit = (m: Material) => {
    setEditingMaterial(m);
    setForm({
      name: m.name,
      unit: m.unit,
      current_quantity: m.current_quantity.toString(),
      min_quantity: m.min_quantity.toString(),
      price_per_unit: m.price_per_unit.toString(),
    });
    setDialogOpen(true);
  };

  const lowStockMaterials = materials.filter(m => m.current_quantity <= m.min_quantity);

  if (loading) return <div className="text-center py-4">Učitavanje...</div>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="warehouse" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="warehouse">
            <Package className="w-4 h-4 mr-2 hidden sm:inline" />
            Skladište
          </TabsTrigger>
          <TabsTrigger value="normatives">
            Normativi
          </TabsTrigger>
          <TabsTrigger value="reports">
            <TrendingDown className="w-4 h-4 mr-2 hidden sm:inline" />
            Izvještaji
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouse" className="mt-4 space-y-4">
          {lowStockMaterials.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5" />
                  Niske zalihe ({lowStockMaterials.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {lowStockMaterials.map(m => (
                    <Badge key={m.id} variant="destructive">
                      {m.name}: {m.current_quantity} {m.unit} (min: {m.min_quantity})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Materijali i sirovine</h3>
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Dodaj materijal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingMaterial ? "Uredi materijal" : "Novi materijal"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Naziv</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="npr. Boja za kosu" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Jedinica mjere</Label>
                      <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cijena po jedinici (€)</Label>
                      <Input type="number" step="0.01" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Trenutna količina</Label>
                      <Input type="number" step="0.01" value={form.current_quantity} onChange={e => setForm({ ...form, current_quantity: e.target.value })} />
                    </div>
                    <div>
                      <Label>Minimalna količina</Label>
                      <Input type="number" step="0.01" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={handleSubmit} className="w-full">
                    {editingMaterial ? "Spremi promjene" : "Dodaj materijal"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Add stock dialog */}
          <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dodaj zalihe - {selectedMaterialForStock?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Količina ({selectedMaterialForStock?.unit})</Label>
                  <Input type="number" step="0.01" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} placeholder="Unesite količinu" />
                </div>
                <Button onClick={handleAddStock} className="w-full">Dodaj na zalihu</Button>
              </div>
            </DialogContent>
          </Dialog>

          {materials.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                Nema materijala. Dodajte prvi materijal.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {materials.map(m => (
                <Card key={m.id} className={m.current_quantity <= m.min_quantity ? "border-destructive/50" : ""}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.current_quantity <= m.min_quantity && (
                          <Badge variant="destructive" className="text-xs">Niska zaliha</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="font-semibold text-foreground">{m.current_quantity} {m.unit}</span>
                        {" · "}Min: {m.min_quantity} {m.unit}
                        {" · "}{m.price_per_unit.toFixed(2)} €/{m.unit}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedMaterialForStock(m); setAddStockOpen(true); }}>
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="normatives" className="mt-4">
          <ServiceNormatives businessId={businessId} materials={materials} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <InventoryReport businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryManagement;
