import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BusinessSetupProps {
  onComplete: () => void;
}

const categories = [
  "Kozmetički salon",
  "Frizerski salon",
  "Spa & Wellness",
  "Manikura & Pedikura",
  "Masaža",
  "Tetoviranje",
  "Ostalo"
];

const BusinessSetup = ({ onComplete }: BusinessSetupProps) => {
  const [loading, setLoading] = useState(false);
  const [existingBusiness, setExistingBusiness] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    address: "",
    phone: "",
    email: "",
  });
  const [workingHours, setWorkingHours] = useState({
    monday: "09:00-17:00",
    tuesday: "09:00-17:00",
    wednesday: "09:00-17:00",
    thursday: "09:00-17:00",
    friday: "09:00-17:00",
    saturday: "closed",
    sunday: "closed",
  });

  useEffect(() => {
    loadExistingBusiness();
  }, []);

  const loadExistingBusiness = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (data) {
      setExistingBusiness(data);
      setFormData({
        name: data.name || "",
        description: data.description || "",
        category: data.category || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
      });
      if (data.working_hours) {
        setWorkingHours(data.working_hours as any);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      if (existingBusiness) {
        const { error } = await supabase
          .from("businesses")
          .update({ ...formData, working_hours: workingHours })
          .eq("id", existingBusiness.id);

        if (error) throw error;
        toast.success("Tvrtka je uspješno ažurirana!");
      } else {
        const { error } = await supabase
          .from("businesses")
          .insert([{ ...formData, owner_id: user.id, working_hours: workingHours }]);

        if (error) throw error;
        toast.success("Tvrtka je uspješno kreirana!");
      }

      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Greška prilikom spremanja");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-medium">
      <CardHeader>
        <CardTitle className="text-2xl">
          {existingBusiness ? "Uredi tvrtku" : "Postavi tvrtku"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naziv tvrtke *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategorija *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Odaberite kategoriju" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresa</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-semibold">Radno vrijeme</Label>
            {Object.entries(workingHours).map(([day, hours]) => {
              const dayNames: Record<string, string> = {
                monday: "Ponedjeljak",
                tuesday: "Utorak",
                wednesday: "Srijeda",
                thursday: "Četvrtak",
                friday: "Petak",
                saturday: "Subota",
                sunday: "Nedjelja",
              };
              
              return (
                <div key={day} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <Label>{dayNames[day]}</Label>
                  <Select
                    value={hours === "closed" ? "closed" : "open"}
                    onValueChange={(value) => {
                      setWorkingHours({
                        ...workingHours,
                        [day]: value === "closed" ? "closed" : "09:00-17:00",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Otvoreno</SelectItem>
                      <SelectItem value="closed">Zatvoreno</SelectItem>
                    </SelectContent>
                  </Select>
                  {hours !== "closed" && (
                    <div className="flex gap-2 items-center">
                      <Input
                        type="time"
                        value={hours.split("-")[0]}
                        onChange={(e) => {
                          const [, end] = hours.split("-");
                          setWorkingHours({
                            ...workingHours,
                            [day]: `${e.target.value}-${end}`,
                          });
                        }}
                      />
                      <span>-</span>
                      <Input
                        type="time"
                        value={hours.split("-")[1]}
                        onChange={(e) => {
                          const [start] = hours.split("-");
                          setWorkingHours({
                            ...workingHours,
                            [day]: `${start}-${e.target.value}`,
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Spremanje..." : existingBusiness ? "Ažuriraj" : "Kreiraj tvrtku"}
            </Button>
            {existingBusiness && (
              <Button type="button" variant="outline" onClick={onComplete}>
                Odustani
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BusinessSetup;
