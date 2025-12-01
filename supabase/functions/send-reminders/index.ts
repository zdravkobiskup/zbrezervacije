import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting reminder check...");
    
    const now = new Date();
    const oneDayLater = new Date(now);
    oneDayLater.setDate(oneDayLater.getDate() + 1);
    
    const sixHoursLater = new Date(now);
    sixHoursLater.setHours(sixHoursLater.getHours() + 6);

    // Get bookings for reminders (24h and 6h before)
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        booking_time,
        status,
        businesses(name),
        services(name),
        profiles(email, full_name)
      `)
      .in("status", ["pending", "confirmed"])
      .gte("booking_date", now.toISOString().split('T')[0])
      .lte("booking_date", oneDayLater.toISOString().split('T')[0]);

    if (error) {
      console.error("Error fetching bookings:", error);
      throw error;
    }

    console.log(`Found ${bookings?.length || 0} bookings to check`);

    const remindersSent = [];

    for (const booking of bookings || []) {
      try {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
        const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        console.log(`Booking ${booking.id}: ${hoursUntilBooking.toFixed(2)} hours until appointment`);

        const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
        const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;

        // Send 24h reminder if between 23-25 hours before
        if (hoursUntilBooking >= 23 && hoursUntilBooking <= 25) {
          console.log(`Sending 24h reminder for booking ${booking.id}`);
          
          const emailResponse = await supabase.functions.invoke("send-booking-email", {
            body: {
              type: "reminder",
              bookingId: booking.id,
              clientEmail: profile?.email || "",
              clientName: profile?.full_name || "Korisnik",
              businessName: business?.name || "",
              serviceName: service?.name || "",
              bookingDate: booking.booking_date,
              bookingTime: booking.booking_time,
            },
          });

          if (emailResponse.error) {
            console.error(`Error sending 24h reminder for booking ${booking.id}:`, emailResponse.error);
          } else {
            remindersSent.push({ bookingId: booking.id, type: "24h" });
          }
        }
        
        // Send 6h reminder if between 5.5-6.5 hours before
        else if (hoursUntilBooking >= 5.5 && hoursUntilBooking <= 6.5) {
          console.log(`Sending 6h reminder for booking ${booking.id}`);
          
          const emailResponse = await supabase.functions.invoke("send-booking-email", {
            body: {
              type: "reminder",
              bookingId: booking.id,
              clientEmail: profile?.email || "",
              clientName: profile?.full_name || "Korisnik",
              businessName: business?.name || "",
              serviceName: service?.name || "",
              bookingDate: booking.booking_date,
              bookingTime: booking.booking_time,
            },
          });

          if (emailResponse.error) {
            console.error(`Error sending 6h reminder for booking ${booking.id}:`, emailResponse.error);
          } else {
            remindersSent.push({ bookingId: booking.id, type: "6h" });
          }
        }
      } catch (bookingError) {
        console.error(`Error processing booking ${booking.id}:`, bookingError);
      }
    }

    console.log(`Sent ${remindersSent.length} reminders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersSent: remindersSent.length,
        details: remindersSent 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
