import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  duration_minutes: number;
  price: number;
}

interface Employee {
  id: string;
  name: string;
  color: string;
}

interface ManualBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  businessName: string;
  workingHours?: any;
  onSuccess: () => void;
}

const timeSlots = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

const ManualBookingDialog = ({ 
  open, 
  onOpenChange, 
  businessId, 
  businessName, 
  workingHours,
  onSuccess 
}: ManualBookingDialogProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadServices();
      loadEmployees();
      setBookedSlots([]);
    }
  }, [open, businessId]);

  useEffect(() => {
    if (selectedDate && (employees.length === 0 || selectedEmployee)) {
      loadBookedSlots();
    }
  }, [selectedDate, businessId, selectedEmployee, employees.length]);

  // Real-time subscription for bookings
  useEffect(() => {
    if (!open || !selectedDate) return;

    const channel = supabase
      .channel('manual-booking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
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
  }, [open, selectedDate, businessId, selectedEmployee, employees.length]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("business_id", businessId)
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
        .eq("business_id", businessId)
        .eq("is_active", true);

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error loading employees:", error);
    }
  };

  const loadBookedSlots = async () => {
    if (!selectedDate) return;
    
    // If there are employees, require one to be selected before loading slots
    if (employees.length > 0 && (!selectedEmployee || selectedEmployee === "any")) return;

    try {
      let query = supabase
        .from("bookings")
        .select("booking_time, services(duration_minutes)")
        .eq("business_id", businessId)
        .eq("booking_date", format(selectedDate, "yyyy-MM-dd"))
        .in("status", ["pending", "confirmed"]);

      // Always filter by selected employee when employees exist
      if (selectedEmployee && selectedEmployee !== "any") {
        query = query.eq("employee_id", selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;

      const occupied: string[] = [];
      data?.forEach((booking: any) => {
        const startTime = booking.booking_time;
        const duration = booking.services?.duration_minutes || 30;
        const slots = Math.ceil(duration / 30);

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
    
    // Require employee selection if there are employees
    if (employees.length > 0 && (!selectedEmployee || selectedEmployee === "any")) {
      toast.error("Molimo odaberite zaposlenika");
      return;
    }
    
    if (!selectedService || !selectedDate || !selectedTime || !clientName.trim()) {
      toast.error("Molimo unesite ime klijenta, uslugu, datum i vrijeme");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      // Create booking with provider as client_id (since manual booking)
      const { error } = await supabase.from("bookings").insert([
        {
          business_id: businessId,
          service_id: selectedService,
          employee_id: selectedEmployee && selectedEmployee !== "any" ? selectedEmployee : null,
          client_id: user.id, // Provider creates booking
          booking_date: format(selectedDate, "yyyy-MM-dd"),
          booking_time: selectedTime,
          notes: `[RUČNA REZERVACIJA] Klijent: ${clientName}${clientPhone ? `, Tel: ${clientPhone}` : ""}${clientEmail ? `, Email: ${clientEmail}` : ""}${notes ? `\n${notes}` : ""}`,
          status: "confirmed", // Auto-confirm manual bookings
        },
      ]);

      if (error) throw error;

      // Send confirmation email if client provided email
      if (clientEmail) {
        try {
          const service = services.find(s => s.id === selectedService);
          await supabase.functions.invoke("send-booking-email", {
            body: {
              type: "confirmation",
              bookingId: "manual",
              clientEmail: clientEmail,
              clientName: clientName,
              businessName: businessName,
              serviceName: service?.name || "",
              bookingDate: format(selectedDate, "dd.MM.yyyy"),
              bookingTime: selectedTime,
            },
          });
        } catch (emailError) {
          console.error("Email sending failed:", emailError);
        }
      }

      toast.success("Rezervacija je uspješno kreirana!");
      onOpenChange(false);
      resetForm();
      onSuccess();
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
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setNotes("");
  };

  const selectedServiceData = services.find((s) => s.id === selectedService);

  const getAvailableSlots = () => {
    if (!selectedServiceData || !selectedDate || !workingHours) return [];

    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = dayNames[selectedDate.getDay()];
    const workingHoursForDay = workingHours[dayName];

    if (!workingHoursForDay || workingHoursForDay === "closed") {
      return [];
    }

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

      if (slotStartMinutes < startMinutes || slotEndMinutes > endMinutes) {
        return false;
      }

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
          <DialogTitle className="text-xl">Ručno dodaj termin</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ime klijenta *</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ime i prezime"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon (opcionalno)</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Broj telefona"
                type="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email (opcionalno - za slanje potvrde)</Label>
            <Input
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="email@primjer.com"
              type="email"
            />
          </div>

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
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Odaberite zaposlenika *</Label>
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
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {workingHours && (() => {
                    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                    const dayName = dayNames[selectedDate.getDay()];
                    return workingHours[dayName] === "closed";
                  })() ? "Zatvoreno na odabrani dan." : "Nema slobodnih termina."}
                </p>
              ) : (
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Odaberite vrijeme" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Napomena (opcionalno)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatne informacije..."
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Spremanje..." : "Dodaj rezervaciju"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManualBookingDialog;
