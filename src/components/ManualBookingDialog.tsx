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
import { matchingClients, parseManualClient, uniqueReturningClients, type ReturningClient } from "@/lib/returning-clients";

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
  const [previousClients, setPreviousClients] = useState<ReturningClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const clientSuggestions = matchingClients(previousClients, clientName);

  useEffect(() => {
    let cancelled = false;
    setPreviousClients([]);
    setSuggestionsOpen(false);
    if (!open) return;

    const loadPreviousClients = async () => {
      setClientsLoading(true);
      try {
        // Read only this business's bookings under the existing access rules.
        const history: { id: string; client_id: string; notes: string | null }[] = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.from("bookings")
            .select("id, client_id, notes")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + pageSize - 1);
          if (error) throw error;
          if (cancelled) return;
          history.push(...(data ?? []));
          if (!data || data.length < pageSize) break;
        }

        const contacts: ReturningClient[] = [];
        const registered = new Map<string, string>();
        for (const booking of history) {
          const manualClient = parseManualClient(booking.notes);
          if (manualClient) contacts.push(manualClient);
          else if (!booking.notes?.startsWith("[RUČNA REZERVACIJA]") && !registered.has(booking.client_id)) {
            registered.set(booking.client_id, booking.id);
          }
        }
        // The existing owner-authorized function exposes registered clients' name and email.
        const bookingIds = [...registered.values()];
        for (let index = 0; index < bookingIds.length; index += 10) {
          const results = await Promise.all(bookingIds.slice(index, index + 10).map(async (id) => {
            const { data, error } = await supabase.rpc("get_booking_client_info", { p_booking_id: id });
            if (error) throw error;
            return data?.[0];
          }));
          if (cancelled) return;
          for (const info of results) {
            if (info?.client_name) contacts.push({ name: info.client_name, email: info.client_email ?? "", phone: "" });
          }
        }
        if (!cancelled) setPreviousClients(uniqueReturningClients(contacts));
      } catch {
        if (!cancelled) toast.error("Raniji klijenti nisu učitani. Podatke možete upisati ručno.");
      } finally {
        if (!cancelled) setClientsLoading(false);
      }
    };
    void loadPreviousClients();
    return () => { cancelled = true; };
  }, [open, businessId]);

  const selectClient = (client: ReturningClient) => {
    setClientName(client.name);
    setClientPhone(client.phone);
    setClientEmail(client.email);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

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
      // Use secure function that only returns availability data (not full booking details)
      const { data, error } = await supabase.rpc("get_booking_availability", {
        p_business_id: businessId,
        p_start_date: format(selectedDate, "yyyy-MM-dd"),
        p_end_date: format(selectedDate, "yyyy-MM-dd"),
      });

      if (error) throw error;

      // Filter by selected employee on client side
      const filteredData = (selectedEmployee && selectedEmployee !== "any")
        ? data?.filter((b: any) => b.employee_id === selectedEmployee)
        : data;

      const occupied: string[] = [];
      filteredData?.forEach((booking: any) => {
        const startTime = booking.booking_time;
        const duration = booking.duration_minutes || 30;
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
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
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
            <div className="space-y-2 relative">
              <Label htmlFor="manual-client-name">Ime klijenta *</Label>
              <Input
                id="manual-client-name"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && clientSuggestions.length > 0}
                aria-controls="manual-client-suggestions"
                aria-activedescendant={suggestionsOpen && activeSuggestion >= 0 ? `manual-client-option-${activeSuggestion}` : undefined}
                autoComplete="off"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setSuggestionsOpen(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setSuggestionsOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSuggestionsOpen(false);
                    return;
                  }
                  if (!clientSuggestions.length) return;
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setSuggestionsOpen(true);
                    const next = e.key === "ArrowDown"
                      ? (activeSuggestion + 1) % clientSuggestions.length
                      : (activeSuggestion <= 0 ? clientSuggestions.length : activeSuggestion) - 1;
                    setActiveSuggestion(next);
                    document.getElementById(`manual-client-option-${next}`)?.scrollIntoView({ block: "nearest" });
                  } else if (e.key === "Enter" && suggestionsOpen && activeSuggestion >= 0) {
                    const client = clientSuggestions[activeSuggestion];
                    if (client) {
                      e.preventDefault();
                      selectClient(client);
                    }
                  }
                }}
                placeholder="Ime i prezime"
              />
              {clientsLoading && <p role="status" className="text-xs text-muted-foreground">Učitavanje klijenata...</p>}
              {suggestionsOpen && clientSuggestions.length > 0 && (
                <div id="manual-client-suggestions" role="listbox" aria-label="Raniji klijenti"
                  className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {clientSuggestions.map((client, index) => (
                    <Button key={`${client.name}-${client.email}-${client.phone}`} type="button" variant="ghost"
                      id={`manual-client-option-${index}`} role="option" aria-selected={activeSuggestion === index}
                      tabIndex={-1}
                      className={cn("w-full h-auto min-h-12 rounded-none flex-col items-start gap-1 px-3 py-2 whitespace-normal text-left", activeSuggestion === index && "bg-accent text-accent-foreground")}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectClient(client)}>
                      <span className="font-medium break-words w-full">{client.name}</span>
                      {(client.phone || client.email) && <span className="text-xs text-muted-foreground break-all w-full">{[client.phone, client.email].filter(Boolean).join(" · ")}</span>}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-client-phone">Telefon (opcionalno)</Label>
              <Input
                id="manual-client-phone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Broj telefona"
                type="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-client-email">Email (opcionalno - za slanje potvrde)</Label>
            <Input
              id="manual-client-email"
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
