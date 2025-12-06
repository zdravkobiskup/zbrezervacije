import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, Calendar, Clock, Store, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isBefore, startOfDay, differenceInDays, parseISO } from "date-fns";
import { hr } from "date-fns/locale";
import { toast } from "sonner";
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
  notes: string | null;
  service_name: string;
  service_duration: number;
  business_name: string;
  business_address: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  confirmed: "bg-green-500",
};

const statusLabels: Record<string, string> = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
};

const ClientBookingsCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_date,
          booking_time,
          status,
          notes,
          service_id,
          business_id
        `)
        .eq("client_id", user.id)
        .in("status", ["pending", "confirmed"])
        .gte("booking_date", today)
        .order("booking_date")
        .order("booking_time");

      if (error) throw error;

      if (data && data.length > 0) {
        const serviceIds = [...new Set(data.map(b => b.service_id))];
        const businessIds = [...new Set(data.map(b => b.business_id))];

        const [servicesRes, businessesRes] = await Promise.all([
          supabase.from("services").select("id, name, duration_minutes").in("id", serviceIds),
          supabase.from("businesses").select("id, name, address").in("id", businessIds)
        ]);

        const servicesMap = new Map(servicesRes.data?.map(s => [s.id, s]));
        const businessesMap = new Map(businessesRes.data?.map(b => [b.id, b]));

        const processedBookings: Booking[] = data.map(booking => {
          const service = servicesMap.get(booking.service_id);
          const business = businessesMap.get(booking.business_id);
          return {
            id: booking.id,
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status || "pending",
            notes: booking.notes,
            service_name: service?.name || "Usluga",
            service_duration: service?.duration_minutes || 0,
            business_name: business?.name || "Tvrtka",
            business_address: business?.address || ""
          };
        });

        setBookings(processedBookings);
      } else {
        setBookings([]);
      }
    } catch (error: any) {
      console.error("Error loading bookings:", error);
      toast.error("Greška prilikom učitavanja rezervacija");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);

      if (error) throw error;
      toast.success("Rezervacija je otkazana!");
      loadBookings();
    } catch (error: any) {
      toast.error("Greška prilikom otkazivanja rezervacije");
    }
  };

  const canCancel = (bookingDate: string): boolean => {
    const booking = parseISO(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(booking, today) >= 3;
  };

  const getBookingsForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return bookings.filter(b => b.booking_date === dateStr);
  };

  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      booking.service_name.toLowerCase().includes(searchLower) ||
      booking.business_name.toLowerCase().includes(searchLower) ||
      booking.booking_date.includes(searchLower)
    );
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const dayNames = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

  if (loading) {
    return <div className="text-center py-8">Učitavanje...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Pretraži rezervacije..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[160px] text-center">
            {format(currentDate, "LLLL yyyy", { locale: hr })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Na čekanju</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Potvrđeno</span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {days.map((day) => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());
              const isPast = isBefore(day, startOfDay(new Date()));

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => !isPast && setSelectedDay(isSelected ? null : day)}
                  className={`
                    min-h-[70px] p-1 border rounded-lg transition-all
                    ${!isCurrentMonth || isPast ? "bg-muted/30 text-muted-foreground" : "bg-card cursor-pointer hover:bg-muted/50"}
                    ${isSelected ? "ring-2 ring-primary" : ""}
                    ${isToday ? "border-primary" : "border-border"}
                  `}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 2).map((booking) => (
                      <div
                        key={booking.id}
                        className={`text-xs px-1 py-0.5 rounded truncate text-white ${statusColors[booking.status]}`}
                        title={`${booking.booking_time} - ${booking.service_name}`}
                      >
                        {booking.booking_time.slice(0, 5)}
                      </div>
                    ))}
                    {dayBookings.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayBookings.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base">
              Rezervacije za {format(selectedDay, "d. MMMM yyyy", { locale: hr })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getBookingsForDay(selectedDay).length === 0 ? (
              <p className="text-muted-foreground">Nema rezervacija za ovaj dan.</p>
            ) : (
              <div className="space-y-3">
                {getBookingsForDay(selectedDay).map((booking) => (
                  <div key={booking.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{booking.service_name}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Store className="w-3 h-3" /> {booking.business_name}
                        </p>
                      </div>
                      <Badge className={`${statusColors[booking.status]} text-white`}>
                        {statusLabels[booking.status]}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {booking.booking_time} ({booking.service_duration} min)
                      </span>
                    </div>
                    {canCancel(booking.booking_date) ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full gap-2">
                            <Trash2 className="w-4 h-4" /> Otkaži rezervaciju
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Otkazati rezervaciju?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Jeste li sigurni da želite otkazati ovu rezervaciju?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Odustani</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelBooking(booking.id)}>
                              Otkaži
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
                        Otkazivanje nije moguće manje od 3 dana prije termina
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {bookings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nemate nadolazećih rezervacija</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientBookingsCalendar;
