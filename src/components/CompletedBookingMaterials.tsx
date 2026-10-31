import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { remainingStock, usedQuantity, type UsageChange } from "@/lib/material-usage";

interface Material { id: string; name: string; unit: string; current_quantity: number }
interface Booking { id: string; booking_date: string; booking_time: string; services: { name: string } | null }

export default function CompletedBookingMaterials({ businessId, materials, onSaved }: {
  businessId: string; materials: Material[]; onSaved: () => void;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [changes, setChanges] = useState<UsageChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from("bookings").select("id, booking_date, booking_time, services(name)")
      .eq("business_id", businessId).eq("status", "completed")
      .order("booking_date", { ascending: false }).order("booking_time", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Greška pri učitavanju završenih rezervacija");
        setBookings(data || []);
        setBookingId(data?.[0]?.id || "");
        setLoading(false);
      });
    return () => { active = false; };
  }, [businessId]);

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    setUsageLoading(true);
    setQuantity("");
    setMaterialId("");
    supabase.from("material_transactions").select("material_id, quantity_change")
      .eq("booking_id", bookingId).in("type", ["auto_deduct", "manual_deduct"])
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Greška pri učitavanju potrošnje");
          return;
        }
        setChanges(data || []);
        setUsageLoading(false);
      });
    return () => { active = false; };
  }, [bookingId]);

  const material = materials.find(m => m.id === materialId);
  const previous = usedQuantity(changes, materialId);
  const actual = Number(quantity);
  const remaining = material ? remainingStock(material.current_quantity, previous, actual) : 0;

  const save = async () => {
    if (!material || !bookingId || !quantity.trim() || !Number.isFinite(actual) || actual < 0 || remaining < 0) {
      toast.error("Unesite valjanu količinu unutar dostupne zalihe");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_booking_material_usage", {
        p_booking_id: bookingId, p_material_id: material.id, p_quantity: actual,
      });
      if (error) throw error;
      setChanges(current => [...current, { material_id: material.id, quantity_change: previous - actual }]);
      onSaved();
      toast.success("Potrošnja spremljena i skladište ažurirano");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri spremanju potrošnje");
    } finally { setSaving(false); }
  };

  return <section className="space-y-4 border-t pt-6">
    <h3 className="text-lg font-semibold">Potrošnja za završenu uslugu</h3>
    {loading ? <p className="text-muted-foreground">Učitavanje...</p> : bookings.length === 0
      ? <p className="text-muted-foreground">Nema završenih rezervacija.</p>
      : <>
        <div className="space-y-2">
          <Label htmlFor="usage-booking">Završena rezervacija</Label>
          <Select value={bookingId} onValueChange={setBookingId} disabled={saving}>
            <SelectTrigger id="usage-booking" className="h-auto min-h-10 text-left [&>span]:whitespace-normal"><SelectValue /></SelectTrigger>
            <SelectContent>{bookings.map(b => <SelectItem key={b.id} value={b.id}>
              {b.booking_date.split("-").reverse().join(".")}. · {b.booking_time.slice(0, 5)} · {b.services?.name || "Usluga"} · {b.id.slice(0, 8)}
            </SelectItem>)}</SelectContent>
          </Select>
        </div>
        {materials.filter(m => usedQuantity(changes, m.id) > 0).map(m => <div key={m.id} className="flex justify-between gap-4 border-b py-2 text-sm">
          <span>{m.name}</span><span>{usedQuantity(changes, m.id)} {m.unit}</span>
        </div>)}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="usage-material">Potrošeni materijal</Label>
            <Select value={materialId} disabled={usageLoading || saving} onValueChange={id => {
              setMaterialId(id); setQuantity(String(usedQuantity(changes, id)));
            }}>
              <SelectTrigger id="usage-material"><SelectValue placeholder="Odaberite materijal" /></SelectTrigger>
              <SelectContent>{materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="usage-quantity">Ukupno potrošeno {material ? `(${material.unit})` : ""}</Label>
            <Input id="usage-quantity" type="number" min="0" step="any" value={quantity} disabled={!material || saving || usageLoading} onChange={e => setQuantity(e.target.value)} />
          </div>
        </div>
        {material && <div className="text-sm space-y-1">
          <p>Već evidentirano: {previous} {material.unit}</p>
          <p>Trenutno na skladištu: {material.current_quantity} {material.unit}</p>
          <p className={remaining < 0 ? "text-destructive" : "text-muted-foreground"}>Nakon spremanja: {Number.isFinite(remaining) ? Number(remaining.toFixed(4)) : "—"} {material.unit}</p>
        </div>}
        <Button onClick={save} disabled={saving || usageLoading || !material || !quantity.trim() || !Number.isFinite(actual) || actual < 0 || remaining < 0}>
          <Save />{saving ? "Spremanje..." : "Spremi potrošnju"}
        </Button>
      </>}
  </section>;
}