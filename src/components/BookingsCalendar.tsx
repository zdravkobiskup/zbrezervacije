import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { hr } from "date-fns/locale";
import { toast } from "sonner";

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  employee_id: string | null;
  service: { name: string } | null;
  client: { full_name: string | null; email: string } | null;
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

  useEffect(() => {
    loadData();
  }, [businessId, currentDate]);

  const loadData = async () => {
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const [bookingsRes, employeesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(`
            id,
            booking_date,
            booking_time,
            status,
            employee_id,
            service:services(name),
            client:profiles!bookings_client_id_fkey(full_name, email)
          `)
          .eq("business_id", businessId)
          .gte("booking_date", format(monthStart, "yyyy-MM-dd"))
          .lte("booking_date", format(monthEnd, "yyyy-MM-dd"))
          .order("booking_time"),
        supabase
          .from("employees")
          .select("id, name, color")
          .eq("business_id", businessId)
          .eq("is_active", true)
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (employeesRes.error) throw employeesRes.error;

      // Handle the case where service/client might be arrays
      const processedBookings = (bookingsRes.data || []).map(booking => ({
        ...booking,
        service: Array.isArray(booking.service) ? booking.service[0] : booking.service,
        client: Array.isArray(booking.client) ? booking.client[0] : booking.client
      }));

      setBookings(processedBookings);
      setEmployees(employeesRes.data || []);
    } catch (error: any) {
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
      return true;
    });
  };

  const getEmployeeColor = (employeeId: string | null) => {
    if (!employeeId) return "#9CA3AF";
    const employee = employees.find(e => e.id === employeeId);
    return employee?.color || "#9CA3AF";
  };

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

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`
                    min-h-[80px] p-1 border rounded-lg cursor-pointer transition-colors
                    ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground" : "bg-card"}
                    ${isSelected ? "ring-2 ring-primary" : ""}
                    ${isToday ? "border-primary" : "border-border"}
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
                        className="text-xs px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: getEmployeeColor(booking.employee_id) }}
                        title={`${booking.booking_time} - ${booking.service?.name || "Usluga"}`}
                      >
                        {booking.booking_time.slice(0, 5)}
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
        <Card>
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
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div
                        className="w-1 h-12 rounded-full"
                        style={{ backgroundColor: getEmployeeColor(booking.employee_id) }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{booking.booking_time.slice(0, 5)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs text-white ${STATUS_COLORS[booking.status || "pending"]}`}>
                            {STATUS_LABELS[booking.status || "pending"]}
                          </span>
                        </div>
                        <p className="text-sm">{booking.service?.name || "Usluga"}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.client?.full_name || booking.client?.email || "Klijent"}
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
