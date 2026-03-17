import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { hr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    service_id?: string;
    business_id?: string;
    employee_id?: string | null;
    service_name: string;
    business_name: string;
    booking_date: string;
    booking_time: string;
  } | null;
  onSuccess: () => void;
}

const timeSlots = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

const RescheduleDialog = ({ open, onOpenChange, booking, onSuccess }: RescheduleDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [workingHours, setWorkingHours] = useState<any>(null);
  const [serviceDuration, setServiceDuration] = useState<number>(30);

  useEffect(() => {
    if (open && booking) {
      loadBusinessData();
    }
  }, [open, booking]);

  useEffect(() => {
    if (selectedDate && booking) {
      loadBookedSlots();
    }
  }, [selectedDate, booking]);

  const loadBusinessData = async () => {
    if (!booking?.business_id || !booking?.service_id) return;

    try {
      const { data, error } = await supabase.rpc("get_business_working_hours_and_service", {
        p_business_id: booking.business_id,
        p_service_id: booking.service_id,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setWorkingHours(data[0].working_hours);
        setServiceDuration(data[0].duration_minutes);
      }
    } catch (error) {
      console.error("Error loading business data:", error);
    }
  };

  const loadBookedSlots = async () => {
    if (!selectedDate || !booking?.business_id) return;

    try {
      // Use secure function that only returns availability data (not full booking details)
      const { data, error } = await supabase.rpc("get_booking_availability", {
        p_business_id: booking.business_id,
        p_start_date: format(selectedDate, "yyyy-MM-dd"),
        p_end_date: format(selectedDate, "yyyy-MM-dd"),
      });

      if (error) throw error;

      // Filter by employee and exclude current booking time slot on client side
      const currentBookingTime = booking.booking_time;
      const filteredData = data?.filter((b: any) => {
        if (booking.employee_id && b.employee_id !== booking.employee_id) return false;
        // Exclude current booking's time slot (since we're rescheduling it)
        if (b.booking_time === currentBookingTime) return false;
        return true;
      });

      const occupied: string[] = [];
      filteredData?.forEach((b: any) => {
        const startTime = b.booking_time;
        const duration = b.duration_minutes || 30;
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
      console.error("Error loading booked slots:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime || !booking) {
      toast.error("Molimo odaberite datum i vrijeme");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niste prijavljeni");

      // Get client name for notification
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const clientName = clientProfile?.full_name || "Korisnik";

      // Update the booking
      const { error } = await supabase
        .from("bookings")
        .update({
          booking_date: format(selectedDate, "yyyy-MM-dd"),
          booking_time: selectedTime,
        })
        .eq("id", booking.id);

      if (error) throw error;

      // Send notification email and in-app notification to provider
      try {
        // Get business owner info using secure function
        const { data: ownerData } = await supabase.rpc("get_business_owner_for_notification", {
          p_business_id: booking.business_id,
        });

        if (ownerData && ownerData.length > 0) {
          const owner = ownerData[0];

          // Send email notification
          await supabase.functions.invoke("send-booking-email", {
            body: {
              type: "reschedule_notification",
              clientEmail: owner.owner_email,
              clientName: owner.owner_name || "Pružatelj usluge",
              businessName: booking.business_name,
              serviceName: booking.service_name,
              oldDate: booking.booking_date,
              oldTime: booking.booking_time,
              bookingDate: format(selectedDate, "dd.MM.yyyy"),
              bookingTime: selectedTime,
            },
          });

          // Create in-app notification for the provider
          await supabase.from("notifications").insert({
            user_id: owner.owner_id,
            title: "Termin promijenjen",
            message: `${clientName} je promijenio/la termin za ${booking.service_name} sa ${booking.booking_date} ${booking.booking_time} na ${format(selectedDate, "dd.MM.yyyy")} ${selectedTime}`,
            type: "reschedule",
            related_booking_id: booking.id,
          });
        }
      } catch (notificationError) {
        console.error("Notification sending failed:", notificationError);
      }

      toast.success("Termin je uspješno promijenjen!");
      onOpenChange(false);
      onSuccess();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Greška prilikom promjene termina");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(undefined);
    setSelectedTime("");
  };

  const getAvailableSlots = () => {
    if (!selectedDate || !workingHours) return [];

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

    const slotsNeeded = Math.ceil(serviceDuration / 30);

    return timeSlots.filter((slot) => {
      const [hours, minutes] = slot.split(':').map(Number);
      const slotStartMinutes = hours * 60 + minutes;
      const slotEndMinutes = slotStartMinutes + serviceDuration;

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

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Promijeni termin</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="font-medium">{booking.service_name}</p>
          <p className="text-sm text-muted-foreground">{booking.business_name}</p>
          <p className="text-sm text-muted-foreground">
            Trenutni termin: {booking.booking_date} u {booking.booking_time}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Odaberite novi datum *</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date()}
              className={cn("rounded-md border pointer-events-auto")}
              locale={hr}
            />
          </div>

          {selectedDate && (
            <div className="space-y-2">
              <Label>Odaberite novo vrijeme *</Label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {workingHours && (() => {
                    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                    const dayName = dayNames[selectedDate.getDay()];
                    return workingHours[dayName] === "closed";
                  })() ? "Tvrtka je zatvorena na odabrani dan." : "Nema slobodnih termina za odabrani dan."}
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

          <Button type="submit" className="w-full" disabled={loading || !selectedDate || !selectedTime}>
            {loading ? "Spremanje..." : "Potvrdi promjenu"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleDialog;
