import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Calendar } from "lucide-react";
import BookingDialog from "./BookingDialog";

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  image_url: string;
}

const BusinessList = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja pružatelja usluga");
    } finally {
      setLoading(false);
    }
  };

  const openBookingDialog = (business: Business) => {
    setSelectedBusiness(business);
    setBookingDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  if (businesses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Trenutno nema dostupnih pružatelja usluga</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {businesses.map((business) => (
          <Card key={business.id} className="shadow-soft hover:shadow-medium transition-shadow overflow-hidden">
            {business.image_url && (
              <div className="h-48 overflow-hidden bg-gradient-card">
                <img
                  src={business.image_url}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary">{business.category}</Badge>
              </div>
              <CardTitle className="text-xl">{business.name}</CardTitle>
              {business.description && (
                <CardDescription className="line-clamp-2">
                  {business.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {business.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{business.address}</span>
                </div>
              )}
              {business.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{business.phone}</span>
                </div>
              )}
              {business.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{business.email}</span>
                </div>
              )}
              <Button
                className="w-full mt-4 gap-2"
                onClick={() => openBookingDialog(business)}
              >
                <Calendar className="w-4 h-4" />
                Rezerviraj termin
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedBusiness && (
        <BookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          business={selectedBusiness}
        />
      )}
    </>
  );
};

export default BusinessList;
