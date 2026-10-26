import ServicePrices from "./ServicePrices";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { hr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  base_price?: number | null;
  sale_price?: number | null;
  lowest_price_30d?: number | null;
}

interface Employee {
  id: string;
  name: string;
  color: string;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: {
    id: string;
    name: string;
    working_hours?: any;
  };
}

const timeSlots = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

const BookingDialog = ({ open, onOpenChange, business }: BookingDialogProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadServices();
      loadEmployees();
      setBookedSlots([]);
    }
  }, [open, business.id]);

  useEffect(() => {
    if (selectedDate && (employees.length === 0 || selectedEmployee)) {
      loadBookedSlots();
    }
  }, [selectedDate, business.id, selectedEmployee, employees.length]);

  // Real-time subscription for bookings
  useEffect(() => {
    if (!open || !selectedDate) return;

    const channel = supabase
      .channel('booking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${business.id}`
        },
        () => {
          // Reload booked slots when any booking changes
          if (selectedDate && (employees.length === 0 || selectedEmployee)) {
            loadBookedSlots();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, selectedDate, business.id, selectedEmployee, employees.length]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true);

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja usluga");
    }
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, color")
        .eq("business_id", business.id)
        .eq("is_active", true);

      if (error) throw error;
      const employeeList = data || [];
      setEmployees(employeeList);
      
      // Auto-select if there's only one employee
      if (employeeList.length === 1) {
        setSelectedEmployee(employeeList[0].id);
      }
    } catch (error: any) {
      console.error("Error loading employees:", error);
    }
  };

  const loadBookedSlots = async () => {
    if (!selectedDate) return;
    
    // If there are employees, require one to be selected before loading slots
    if (employees.length > 0 && !selectedEmployee) return;

    try {
      // Use secure function that only returns availability data (not full booking details)
      const { data, error } = await supabase.rpc("get_booking_availability", {
        p_business_id: business.id,
        p_start_date: format(selectedDate, "yyyy-MM-dd"),
        p_end_date: format(selectedDate, "yyyy-MM-dd"),
      });

      if (error) throw error;

      // Filter by selected employee on client side
      const filteredData = selectedEmployee
        ? data?.filter((b: any) => b.employee_id === selectedEmployee)
        : data;

      const occupied: string[] = [];
      filteredData?.forEach((booking: any) => {
        const startTime = booking.booking_time;
        const duration = booking.duration_minutes || 30;
        const slots = Math.ceil(duration / 30);

        // Mark all 30-minute slots occupied by this booking
        const [hours, minutes] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;

        for (let i = 0; i < slots; i++) {
          const slotMinutes = startMinutes + (i * 30);
          const slotHours = Math.floor(slotMinutes / 60);
          const slotMins = slotMinutes % 60;
          const slotTime = `${slotHours.toString().padStart(2, "0")}:${slotMins.toString().padStart(2, "0")}`;
          occupied.push(slotTime);
        }
      });

      setBookedSlots(occupied);
    } catch (error: any) {
      toast.error("Greška prilikom učitavanja zauzetih termina");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require employee selection if there are multiple employees
    if (employees.length > 1 && !selectedEmployee) {
      toast.error("Molimo odaberite zaposlenika");
      return;
    }
    
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.error("Molimo ispunite sva obavezna polja");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      // Get client profile
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const clientName = clientProfile?.full_name || user.email || "Korisnik";

      const { data: newBooking, error } = await supabase.from("bookings").insert([
        {
          business_id: business.id,
          service_id: selectedService,
          employee_id: selectedEmployee && selectedEmployee !== "any" ? selectedEmployee : null,
          client_id: user.id,
          booking_date: format(selectedDate, "yyyy-MM-dd"),
          booking_time: selectedTime,
          notes: notes,
          status: "pending",
        },
      ]).select().single();

      if (error) throw error;

      const service = services.find(s => s.id === selectedService);

      // Send confirmation email to client
      try {
        await supabase.functions.invoke("send-booking-email", {
          body: {
            type: "confirmation",
            bookingId: newBooking.id,
            clientEmail: user.email,
            clientName: clientName,
            businessName: business.name,
            serviceName: service?.name || "",
            bookingDate: format(selectedDate, "dd.MM.yyyy"),
            bookingTime: selectedTime,
          },
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }

      // Create in-app notification for provider about new booking
      try {
        const { data: businessData } = await supabase
          .from("businesses")
          .select("owner_id")
          .eq("id", business.id)
          .single();

        if (businessData) {
          await supabase.from("notifications").insert({
            user_id: businessData.owner_id,
            title: "Nova rezervacija",
            message: `${clientName} je rezervirao/la ${service?.name || "uslugu"} za ${format(selectedDate, "d. MMMM yyyy", { locale: hr })} u ${selectedTime}`,
            type: "new_booking",
            related_booking_id: newBooking.id,
          });
        }
      } catch (notifError) {
        console.error("Failed to create notification:", notifError);
      }

      // Create in-app notification for client
      try {
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Rezervacija kreirana",
          message: `Vaša rezervacija za ${service?.name} kod ${business.name} dana ${format(selectedDate, "d. MMMM yyyy", { locale: hr })} u ${selectedTime} je uspješno kreirana i čeka potvrdu.`,
          type: "confirmation",
          related_booking_id: newBooking.id,
        });
      } catch (notifError) {
        console.error("Failed to create client notification:", notifError);
      }

      toast.success("Rezervacija je uspješno kreirana!");
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Greška prilikom kreiranja rezervacije");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedService("");
    setSelectedEmployee("");
    setSelectedDate(undefined);
    setSelectedTime("");
    setNotes("");
  };

  const selectedServiceData = services.find((s) => s.id === selectedService);

  const getAvailableSlots = () => {
    if (!selectedServiceData || !selectedDate) return [];

    // Get working hours for the selected day
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = dayNames[selectedDate.getDay()];
    const workingHoursForDay = business.working_hours?.[dayName];

    if (!workingHoursForDay || workingHoursForDay === "closed") {
      return [];
    }

    // Parse working hours (e.g., "09:00-17:00")
    const [startTime, endTime] = workingHoursForDay.split("-");
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const serviceDuration = selectedServiceData.duration_minutes;
    const slotsNeeded = Math.ceil(serviceDuration / 30);

    // Check if selected date is today
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return timeSlots.filter((slot) => {
      const [hours, minutes] = slot.split(':').map(Number);
      const slotStartMinutes = hours * 60 + minutes;
      const slotEndMinutes = slotStartMinutes + serviceDuration;

      // If today, filter out past time slots
      if (isToday && slotStartMinutes <= currentMinutes) {
        return false;
      }

      // Check if slot is within working hours
      if (slotStartMinutes < startMinutes || slotEndMinutes > endMinutes) {
        return false;
      }

      // Check if this slot and all subsequent required slots are available
      for (let i = 0; i < slotsNeeded; i++) {
        const checkMinutes = slotStartMinutes + (i * 30);
        const checkHours = Math.floor(checkMinutes / 60);
        const checkMins = checkMinutes % 60;
        const checkTime = `${checkHours.toString().padStart(2, "0")}:${checkMins.toString().padStart(2, "0")}`;
        
        if (bookedSlots.includes(checkTime)) {
          return false;
        }
      }
      return true;
    });
  };

  const availableSlots = getAvailableSlots();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Rezerviraj termin - {business.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Odaberite uslugu *</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Odaberite uslugu" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex justify-between items-center w-full">
                      <span>{service.name}</span>
                      <span className="text-sm text-muted-foreground ml-4">
                        {service.duration_minutes}min - €{(service.sale_price ?? service.price).toFixed(2)}{service.sale_price != null ? " (akcija)" : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedServiceData?.description && (
              <p className="text-sm text-muted-foreground">{selectedServiceData.description}</p>
            )}
            {selectedServiceData && (
              <div className="rounded-lg border p-3"><ServicePrices {...selectedServiceData} /></div>
            )}
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Odaberite zaposlenika {employees.length > 1 ? "*" : ""}</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Odaberite zaposlenika" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: employee.color }}
                        />
                        {employee.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Odaberite datum *</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              className={cn("rounded-md border pointer-events-auto")}
              locale={hr}
            />
          </div>

          {selectedDate && selectedService && (
            <div className="space-y-2">
              <Label>Odaberite vrijeme *</Label>
              {availableSlots.length === 0 && selectedDate && business.working_hours && (() => {
                const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const dayName = dayNames[selectedDate.getDay()];
                const workingHoursForDay = business.working_hours[dayName];
                return workingHoursForDay === "closed";
              })() ? (
                <p className="text-sm text-muted-foreground py-2">
                  Tvrtka je zatvorena na odabrani dan.
                </p>
              ) : (
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Odaberite vrijeme" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.length > 0 ? (
                      availableSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-slots" disabled>
                        Nema slobodnih termina
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Napomena (opcionalno)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatne informacije ili posebni zahtjevi..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Spremanje..." : "Potvrdi rezervaciju"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
