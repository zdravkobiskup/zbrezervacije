import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, Clock, User, Store, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { hr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

interface BookingsListProps {
  businessId?: string;
  isBusinessView: boolean;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
};

const statusLabels = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  cancelled: "Otkazano",
  completed: "Završeno",
};

const BookingsList = ({ businessId, isBusinessView }: BookingsListProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (isBusinessView && businessId) {
        query = query.eq("business_id", businessId);
      } else if (!isBusinessView) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch client profiles separately
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
      toast.error("Greška prilikom učitavanja rezervacija");
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;

      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);

      if (error) throw error;

      // Send status change email
      try {
        await supabase.functions.invoke("send-booking-email", {
          body: {
            type: "status_change",
            bookingId: bookingId,
            clientEmail: booking.profiles.email,
            clientName: booking.profiles.full_name || "Korisnik",
            businessName: booking.businesses.name,
            serviceName: booking.services.name,
            bookingDate: format(new Date(booking.booking_date), "dd.MM.yyyy"),
            bookingTime: booking.booking_time,
            status: status,
          },
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }

      toast.success("Status rezervacije je ažuriran!");
      loadBookings();
    } catch (error: any) {
      toast.error("Greška prilikom ažuriranja statusa");
    }
  };

  const cancelBooking = async (bookingId: string, cancelledByProvider: boolean = false) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;

      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);

      if (error) throw error;

      // Send cancellation email with rebooking link if cancelled by provider
      try {
        await supabase.functions.invoke("send-booking-email", {
          body: {
            type: "status_change",
            bookingId: bookingId,
            clientEmail: booking.profiles.email,
            clientName: booking.profiles.full_name || "Korisnik",
            businessName: booking.businesses.name,
            serviceName: booking.services.name,
            bookingDate: format(new Date(booking.booking_date), "dd.MM.yyyy"),
            bookingTime: booking.booking_time,
            status: "cancelled",
            cancelledByProvider: cancelledByProvider,
            appUrl: window.location.origin,
          },
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }

      toast.success("Rezervacija je otkazana!");
      loadBookings();
    } catch (error: any) {
      toast.error("Greška prilikom otkazivanja rezervacije");
    }
  };

  // Check if client can cancel (at least 3 days before)
  const canClientCancel = (bookingDate: string): boolean => {
    const booking = parseISO(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilBooking = differenceInDays(booking, today);
    return daysUntilBooking >= 3;
  };

  const getDaysUntilBooking = (bookingDate: string): number => {
    const booking = parseISO(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(booking, today);
  };

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {isBusinessView ? "Nema rezervacija" : "Još niste napravili nijednu rezervaciju"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => {
        const daysUntil = getDaysUntilBooking(booking.booking_date);
        const clientCanCancel = canClientCancel(booking.booking_date);

        return (
          <Card key={booking.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{booking.services.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    {booking.businesses.name}
                  </CardDescription>
                </div>
                <Badge className={statusColors[booking.status as keyof typeof statusColors]}>
                  {statusLabels[booking.status as keyof typeof statusLabels]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {format(new Date(booking.booking_date), "PPP", { locale: hr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{booking.booking_time} ({booking.services.duration_minutes} min)</span>
                  </div>
                  {isBusinessView && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{booking.profiles.full_name || booking.profiles.email}</span>
                    </div>
                  )}
                </div>
                
                {booking.notes && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">Napomena:</p>
                    <p className="text-muted-foreground">{booking.notes}</p>
                  </div>
                )}
              </div>

              {/* Business view actions */}
              {isBusinessView && booking.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 gap-2"
                    onClick={() => updateBookingStatus(booking.id, "confirmed")}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Potvrdi
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-1 gap-2">
                        <XCircle className="w-4 h-4" />
                        Otkaži
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Otkazati rezervaciju?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Jeste li sigurni da želite otkazati ovu rezervaciju? Klijent će dobiti email s mogućnošću rezervacije novog termina.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Odustani</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelBooking(booking.id, true)}>
                          Otkaži rezervaciju
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* Business can also cancel confirmed bookings */}
              {isBusinessView && booking.status === "confirmed" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full gap-2">
                      <XCircle className="w-4 h-4" />
                      Otkaži rezervaciju
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Otkazati potvrđenu rezervaciju?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Jeste li sigurni da želite otkazati ovu potvrđenu rezervaciju? Klijent će dobiti email s mogućnošću rezervacije novog termina.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Odustani</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cancelBooking(booking.id, true)}>
                        Otkaži rezervaciju
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Client view - can cancel pending or confirmed if 3+ days before */}
              {!isBusinessView && (booking.status === "pending" || booking.status === "confirmed") && (
                clientCanCancel ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full gap-2">
                        <Trash2 className="w-4 h-4" />
                        Otkaži rezervaciju
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Otkazati rezervaciju?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Jeste li sigurni da želite otkazati ovu rezervaciju? Ova radnja se ne može poništiti.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Odustani</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelBooking(booking.id, false)}>
                          Otkaži rezervaciju
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <div className="text-sm text-muted-foreground text-center p-2 bg-muted rounded">
                    Otkazivanje nije moguće manje od 3 dana prije termina
                    {daysUntil >= 0 && ` (${daysUntil} ${daysUntil === 1 ? 'dan' : 'dana'} do termina)`}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default BookingsList;
