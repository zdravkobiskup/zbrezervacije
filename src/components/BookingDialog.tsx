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
    }
  }, [open, business.id]);

  useEffect(() => {
    if (selectedDate) {
      loadBookedSlots();
    }
  }, [selectedDate, business.id, selectedEmployee]);

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
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error loading employees:", error);
    }
  };

  const loadBookedSlots = async () => {
    if (!selectedDate) return;

    try {
      let query = supabase
        .from("bookings")
        .select("booking_time, service_id, employee_id, services(duration_minutes)")
        .eq("business_id", business.id)
        .eq("booking_date", format(selectedDate, "yyyy-MM-dd"))
        .in("status", ["pending", "confirmed"]);

      // If an employee is selected, only check their bookings
      if (selectedEmployee) {
        query = query.eq("employee_id", selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;

      const occupied: string[] = [];
      data?.forEach((booking: any) => {
        const startTime = booking.booking_time;
        const duration = booking.services?.duration_minutes || 30;
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
    
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.error("Molimo ispunite sva obavezna polja");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      const { error } = await supabase.from("bookings").insert([
        {
          business_id: business.id,
          service_id: selectedService,
          employee_id: selectedEmployee || null,
          client_id: user.id,
          booking_date: format(selectedDate, "yyyy-MM-dd"),
          booking_time: selectedTime,
          notes: notes,
          status: "pending",
        },
      ]);

      if (error) throw error;

      // Send confirmation email
      try {
        const service = services.find(s => s.id === selectedService);
        await supabase.functions.invoke("send-booking-email", {
          body: {
            type: "confirmation",
            bookingId: "new",
            clientEmail: user.email,
            clientName: user.email,
            businessName: business.name,
            serviceName: service?.name || "",
            bookingDate: format(selectedDate, "dd.MM.yyyy"),
            bookingTime: selectedTime,
          },
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't throw - booking is already created
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

    return timeSlots.filter((slot) => {
      const [hours, minutes] = slot.split(':').map(Number);
      const slotStartMinutes = hours * 60 + minutes;
      const slotEndMinutes = slotStartMinutes + serviceDuration;

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
                        {service.duration_minutes}min - €{service.price.toFixed(2)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedServiceData?.description && (
              <p className="text-sm text-muted-foreground">{selectedServiceData.description}</p>
            )}
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Odaberite zaposlenika (opcionalno)</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Bilo koji zaposlenik" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Bilo koji zaposlenik</SelectItem>
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
              disabled={(date) => date < new Date()}
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
