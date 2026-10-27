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

  // Authenticate: service role key bearer, or a scheduled callback using the
  // project's public anon key (the standard pg_cron → edge function pattern).
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aXdzeGNudWFyYXJkaHd6a3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjU4NjMsImV4cCI6MjA4MDEwMTg2M30.gIKmnATnywO_yfK_1Q2PT8ZgWERrHiibT9q3NbZyvrI";
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
  const apikey = req.headers.get("apikey") ?? "";
  if (token !== supabaseServiceKey && apikey !== ANON_KEY && token !== ANON_KEY) {
    console.error("Missing or invalid Authorization header");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    console.log("Starting reminder check...");
    
    const now = new Date();
    const oneDayLater = new Date(now);
    oneDayLater.setDate(oneDayLater.getDate() + 1);
    
    // Calculate yesterday for no-show follow-ups
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get bookings for upcoming reminders
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        booking_time,
        status,
        client_id,
        business_id,
        service_id
      `)
      .in("status", ["pending", "confirmed"])
      .gte("booking_date", now.toISOString().split('T')[0])
      .lte("booking_date", oneDayLater.toISOString().split('T')[0]);

    if (error) {
      console.error("Error fetching bookings:", error);
      throw error;
    }

    // Get no-show bookings from the last 24 hours to send follow-up emails
    const { data: noShowBookings, error: noShowError } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        booking_time,
        status,
        client_id,
        business_id,
        service_id,
        updated_at
      `)
      .eq("status", "no_show")
      .gte("updated_at", yesterday.toISOString());

    if (noShowError) {
      console.error("Error fetching no-show bookings:", noShowError);
    }

    console.log(`Found ${bookings?.length || 0} upcoming bookings and ${noShowBookings?.length || 0} no-show bookings`);

    const remindersSent = [];

    for (const booking of bookings || []) {
      try {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
        const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        console.log(`Booking ${booking.id}: ${hoursUntilBooking.toFixed(2)} hours until appointment`);

        // Fetch related data separately
        const [profileResult, businessResult, serviceResult] = await Promise.all([
          supabase.from("profiles").select("email, full_name").eq("id", booking.client_id).maybeSingle(),
          supabase.from("businesses").select("name").eq("id", booking.business_id).maybeSingle(),
          supabase.from("services").select("name").eq("id", booking.service_id).maybeSingle()
        ]);

        const profile = profileResult.data;
        const business = businessResult.data;
        const service = serviceResult.data;

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

    // Process no-show follow-up emails
    for (const booking of noShowBookings || []) {
      try {
        const updatedAt = new Date(booking.updated_at);
        const hoursSinceNoShow = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

        // Send follow-up email 1-3 hours after being marked as no-show
        if (hoursSinceNoShow >= 1 && hoursSinceNoShow <= 3) {
          console.log(`Sending no-show follow-up for booking ${booking.id}`);

          const [profileResult, businessResult, serviceResult] = await Promise.all([
            supabase.from("profiles").select("email, full_name").eq("id", booking.client_id).maybeSingle(),
            supabase.from("businesses").select("name").eq("id", booking.business_id).maybeSingle(),
            supabase.from("services").select("name").eq("id", booking.service_id).maybeSingle()
          ]);

          const profile = profileResult.data;
          const business = businessResult.data;
          const service = serviceResult.data;

          if (profile?.email) {
            const emailResponse = await supabase.functions.invoke("send-booking-email", {
              body: {
                type: "no_show_followup",
                bookingId: booking.id,
                clientEmail: profile.email,
                clientName: profile.full_name || "Korisnik",
                businessName: business?.name || "",
                serviceName: service?.name || "",
                bookingDate: booking.booking_date,
                bookingTime: booking.booking_time,
              },
            });

            if (emailResponse.error) {
              console.error(`Error sending no-show follow-up for booking ${booking.id}:`, emailResponse.error);
            } else {
              remindersSent.push({ bookingId: booking.id, type: "no_show_followup" });
            }
          }
        }
      } catch (bookingError) {
        console.error(`Error processing no-show booking ${booking.id}:`, bookingError);
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
