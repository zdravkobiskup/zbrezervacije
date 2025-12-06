import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, User, Store, Search } from "lucide-react";
import { format } from "date-fns";
import { hr } from "date-fns/locale";

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  notes: string;
  services: {
    name: string;
    duration_minutes: number;
    price: number;
  };
  businesses: {
    name: string;
    address: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

interface BookingsArchiveProps {
  businessId?: string;
  isBusinessView: boolean;
}

const statusColors: Record<string, string> = {
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
  rescheduled: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  completed: "Završeno",
  no_show: "Nije došao/la",
  rescheduled: "Promijenjen termin",
  cancelled: "Otkazano",
};

const BookingsArchive = ({ businessId, isBusinessView }: BookingsArchiveProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadBookings();
  }, [businessId]);

  const loadBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("bookings")
        .select(`
          *,
          services (name, duration_minutes, price),
          businesses (name, address)
        `)
        .in("status", ["completed", "no_show", "rescheduled", "cancelled"])
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });

      if (isBusinessView && businessId) {
        query = query.eq("business_id", businessId);
      } else if (!isBusinessView) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const clientIds = [...new Set(data.map(b => b.client_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", clientIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
        const bookingsWithProfiles = data.map(booking => ({
          ...booking,
          profiles: profilesMap.get(booking.client_id) || { full_name: "", email: "" }
        }));

        setBookings(bookingsWithProfiles as any);
      } else {
        setBookings([]);
      }
    } catch (error: any) {
      console.error("Error loading archive:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      booking.services?.name?.toLowerCase().includes(searchLower) ||
      booking.businesses?.name?.toLowerCase().includes(searchLower) ||
      booking.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      booking.profiles?.email?.toLowerCase().includes(searchLower) ||
      booking.booking_date.includes(searchLower)
    );
  });

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Pretraži po usluzi, klijentu, datumu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm ? "Nema rezultata pretrage" : "Nema arhiviranih rezervacija"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <Card key={booking.id} className="shadow-soft">
              <CardHeader className="py-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{booking.services?.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-sm">
                      <Store className="w-3 h-3" />
                      {booking.businesses?.name}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[booking.status as keyof typeof statusColors]}>
                    {statusLabels[booking.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="py-2 pb-4">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(booking.booking_date), "d.MM.yyyy", { locale: hr })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {booking.booking_time}
                  </div>
                  {isBusinessView && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {booking.profiles?.full_name || booking.profiles?.email}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsArchive;
