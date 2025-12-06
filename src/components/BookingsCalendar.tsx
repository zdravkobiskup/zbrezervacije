import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, GripVertical, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { hr } from "date-fns/locale";
import { toast } from "sonner";

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  employee_id: string | null;
  service_name: string | null;
  client_name: string | null;
  client_email: string | null;
}

interface Employee {
  id: string;
  name: string;
  color: string;
}

interface BookingsCalendarProps {
  businessId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
  completed: "bg-blue-500"
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  cancelled: "Otkazano",
  completed: "Završeno"
};

const BookingsCalendar = ({ businessId }: BookingsCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, [businessId, currentDate]);

  const loadData = async () => {
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      // First, get bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_date,
          booking_time,
          status,
          employee_id,
          service_id,
          client_id
        `)
        .eq("business_id", businessId)
        .gte("booking_date", format(monthStart, "yyyy-MM-dd"))
        .lte("booking_date", format(monthEnd, "yyyy-MM-dd"))
        .order("booking_time");

      if (bookingsError) throw bookingsError;

      // Get services and profiles separately
      const serviceIds = [...new Set((bookingsData || []).map(b => b.service_id).filter(Boolean))];
      const clientIds = [...new Set((bookingsData || []).map(b => b.client_id).filter(Boolean))];

      const [servicesRes, profilesRes, employeesRes] = await Promise.all([
        serviceIds.length > 0 
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : { data: [], error: null },
        clientIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email").in("id", clientIds)
          : { data: [], error: null },
        supabase
          .from("employees")
          .select("id, name, color")
          .eq("business_id", businessId)
          .eq("is_active", true)
      ]);

      if (employeesRes.error) throw employeesRes.error;

      const servicesMap = new Map((servicesRes.data || []).map(s => [s.id, s.name]));
      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, { full_name: p.full_name, email: p.email }]));

      const processedBookings: Booking[] = (bookingsData || []).map(booking => {
        const profile = profilesMap.get(booking.client_id);
        return {
          id: booking.id,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          status: booking.status || "pending",
          employee_id: booking.employee_id,
          service_name: servicesMap.get(booking.service_id) || null,
          client_name: profile?.full_name || null,
          client_email: profile?.email || null
        };
      });

      setBookings(processedBookings);
      setEmployees(employeesRes.data || []);
    } catch (error: any) {
      console.error("Calendar load error:", error);
      toast.error("Greška prilikom učitavanja podataka");
    } finally {
      setLoading(false);
    }
  };

  const getBookingsForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return bookings.filter(b => {
      if (b.booking_date !== dateStr) return false;
      if (selectedEmployee !== "all" && b.employee_id !== selectedEmployee) return false;
      
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          b.service_name?.toLowerCase().includes(searchLower) ||
          b.client_name?.toLowerCase().includes(searchLower) ||
          b.client_email?.toLowerCase().includes(searchLower) ||
          b.booking_time.includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  };

  const getEmployeeColor = (employeeId: string | null) => {
    if (!employeeId) return "#9CA3AF";
    const employee = employees.find(e => e.id === employeeId);
    return employee?.color || "#9CA3AF";
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, booking: Booking) => {
    setDraggedBooking(booking);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", booking.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    
    if (!draggedBooking) return;

    const newDateStr = format(targetDate, "yyyy-MM-dd");
    
    if (draggedBooking.booking_date === newDateStr) {
      setDraggedBooking(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ booking_date: newDateStr })
        .eq("id", draggedBooking.id);

      if (error) throw error;

      toast.success(`Rezervacija premještena na ${format(targetDate, "d. MMMM", { locale: hr })}`);
      
      // Update local state
      setBookings(prev => prev.map(b => 
        b.id === draggedBooking.id 
          ? { ...b, booking_date: newDateStr }
          : b
      ));
    } catch (error: any) {
      toast.error("Greška prilikom premještanja rezervacije");
    } finally {
      setDraggedBooking(null);
    }
  }, [draggedBooking]);

  const handleDragEnd = useCallback(() => {
    setDraggedBooking(null);
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const dayNames = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

  if (loading) {
    return <div className="text-center py-8">Učitavanje kalendara...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Pretraži po klijentu, usluzi..."
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

        <div className="flex items-center gap-4">
          {employees.length > 0 && (
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Svi zaposlenici" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi zaposlenici</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: emp.color }}
                      />
                      {emp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="w-4 h-4" />
          <span>Povucite rezervaciju za premještanje</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day) => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());
              const isDragTarget = draggedBooking && draggedBooking.booking_date !== format(day, "yyyy-MM-dd");

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className={`
                    min-h-[80px] p-1 border rounded-lg cursor-pointer transition-all
                    ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground" : "bg-card"}
                    ${isSelected ? "ring-2 ring-primary" : ""}
                    ${isToday ? "border-primary" : "border-border"}
                    ${isDragTarget ? "bg-primary/10 border-primary border-dashed" : ""}
                    hover:bg-muted/50
                  `}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, booking)}
                        onDragEnd={handleDragEnd}
                        className={`
                          text-xs px-1 py-0.5 rounded truncate text-white cursor-grab active:cursor-grabbing
                          flex items-center gap-1 hover:opacity-90 transition-opacity
                          ${draggedBooking?.id === booking.id ? "opacity-50" : ""}
                        `}
                        style={{ backgroundColor: getEmployeeColor(booking.employee_id) }}
                        title={`${booking.booking_time} - ${booking.service_name || "Usluga"} (povucite za premještanje)`}
                      >
                        <GripVertical className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{booking.booking_time.slice(0, 5)}</span>
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayBookings.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
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
                {getBookingsForDay(selectedDay).map((booking) => {
                  const employee = employees.find(e => e.id === booking.employee_id);
                  return (
                    <div
                      key={booking.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, booking)}
                      onDragEnd={handleDragEnd}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing
                        hover:bg-muted/50 transition-colors
                        ${draggedBooking?.id === booking.id ? "opacity-50" : ""}
                      `}
                    >
                      <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div
                        className="w-1 h-12 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getEmployeeColor(booking.employee_id) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{booking.booking_time.slice(0, 5)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs text-white ${STATUS_COLORS[booking.status || "pending"]}`}>
                            {STATUS_LABELS[booking.status || "pending"]}
                          </span>
                        </div>
                        <p className="text-sm truncate">{booking.service_name || "Usluga"}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {booking.client_name || booking.client_email || "Klijent"}
                          {employee && ` • ${employee.name}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BookingsCalendar;
