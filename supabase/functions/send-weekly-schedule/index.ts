import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_HR = {
  monday: "Ponedjeljak",
  tuesday: "Utorak",
  wednesday: "Srijeda",
  thursday: "Četvrtak",
  friday: "Petak",
  saturday: "Subota",
  sunday: "Nedjelja"
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  notes: string | null;
  services: { name: string; duration_minutes: number } | null;
}

interface Employee {
  id: string;
  name: string;
  email: string | null;
  business_id: string;
  working_hours: Record<string, string> | null;
  group_id: string | null;
}

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
    console.log("Starting weekly schedule email sending...");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Calculate next week's date range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    const startDate = nextMonday.toISOString().split('T')[0];
    const endDate = nextSunday.toISOString().split('T')[0];

    console.log(`Fetching schedule for: ${startDate} to ${endDate}`);

    // Get all active employees with email
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, name, email, business_id, working_hours, group_id")
      .eq("is_active", true)
      .not("email", "is", null);

    if (empError) {
      console.error("Error fetching employees:", empError);
      throw empError;
    }

    console.log(`Found ${employees?.length || 0} employees with email`);

    const emailsSent: string[] = [];

    for (const employee of employees || []) {
      if (!employee.email) continue;

      try {
        // Get business info
        const { data: business } = await supabase
          .from("businesses")
          .select("name, working_hours")
          .eq("id", employee.business_id)
          .single();

        // Get employee group working hours if applicable
        let groupWorkingHours = null;
        if (employee.group_id) {
          const { data: group } = await supabase
            .from("employee_groups")
            .select("working_hours")
            .eq("id", employee.group_id)
            .single();
          groupWorkingHours = group?.working_hours;
        }

        // Determine working hours priority: employee > group > business
        const workingHours = employee.working_hours || 
                            groupWorkingHours || 
                            business?.working_hours || 
                            {};

        // Get bookings for this employee for next week
        const { data: bookings, error: bookError } = await supabase
          .from("bookings")
          .select("id, booking_date, booking_time, notes, services(name, duration_minutes)")
          .eq("employee_id", employee.id)
          .gte("booking_date", startDate)
          .lte("booking_date", endDate)
          .in("status", ["pending", "confirmed"])
          .order("booking_date", { ascending: true })
          .order("booking_time", { ascending: true });

        if (bookError) {
          console.error(`Error fetching bookings for employee ${employee.id}:`, bookError);
          continue;
        }

        // Group bookings by date
        const bookingsByDate: Record<string, Booking[]> = {};
        (bookings || []).forEach((booking: any) => {
          if (!bookingsByDate[booking.booking_date]) {
            bookingsByDate[booking.booking_date] = [];
          }
          bookingsByDate[booking.booking_date].push(booking);
        });

        // Generate HTML for each day
        const generateDayHTML = (dateStr: string, dayName: string, dayKey: string) => {
          const dayWorkingHours = (workingHours as Record<string, string>)?.[dayKey];
          const isClosed = !dayWorkingHours || dayWorkingHours === "closed";
          const dayBookings = bookingsByDate[dateStr] || [];

          const formatDate = (d: string) => {
            const date = new Date(d);
            return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
          };

          let html = `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: ${isClosed ? '#f5f5f5' : '#fff'};">
              <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
                ${dayName}, ${formatDate(dateStr)}
              </h3>
          `;

          if (isClosed) {
            html += `<p style="color: #888; margin: 0; font-style: italic;">Neradni dan</p>`;
          } else {
            html += `<p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Radno vrijeme: ${dayWorkingHours}</p>`;
            
            if (dayBookings.length === 0) {
              html += `<p style="color: #888; margin: 0; font-style: italic;">Nema rezervacija</p>`;
            } else {
              html += `<ul style="margin: 0; padding-left: 20px;">`;
              dayBookings.forEach(booking => {
                const serviceName = booking.services?.name || "Usluga";
                const duration = booking.services?.duration_minutes || 30;
                html += `
                  <li style="margin-bottom: 8px; color: #333;">
                    <strong>${booking.booking_time}</strong> - ${serviceName} (${duration} min)
                    ${booking.notes ? `<br><span style="color: #666; font-size: 13px;">${booking.notes}</span>` : ""}
                  </li>
                `;
              });
              html += `</ul>`;
            }
          }

          html += `</div>`;
          return html;
        };

        // Generate schedule for each day of next week
        let scheduleHTML = "";
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(nextMonday);
          dayDate.setDate(nextMonday.getDate() + i);
          const dateStr = dayDate.toISOString().split('T')[0];
          const dayKey = DAY_ORDER[i];
          const dayName = DAYS_HR[dayKey as keyof typeof DAYS_HR];
          scheduleHTML += generateDayHTML(dateStr, dayName, dayKey);
        }

        const totalBookings = (bookings || []).length;

        const emailHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Tjedni raspored</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #333; margin-bottom: 5px; font-size: 24px;">Tjedni raspored</h1>
              <p style="color: #666; margin-bottom: 20px; font-size: 14px;">${business?.name || "Vaš posao"}</p>
              
              <p style="color: #333; margin-bottom: 20px;">
                Pozdrav ${employee.name},<br><br>
                Ovo je vaš raspored za sljedeći tjedan (${startDate.split('-').reverse().join('.')} - ${endDate.split('-').reverse().join('.')}).
                ${totalBookings > 0 ? `Imate ukupno <strong>${totalBookings}</strong> rezervacija.` : "Nemate još rezervacija za sljedeći tjedan."}
              </p>
              
              ${scheduleHTML}
              
              <p style="color: #888; font-size: 12px; margin-top: 30px; text-align: center;">
                Ovaj email je automatski generiran. Molimo ne odgovarajte na njega.
              </p>
            </div>
          </body>
          </html>
        `;

        // Send email
        const emailResponse = await resend.emails.send({
          from: "Raspored <onboarding@resend.dev>",
          to: [employee.email],
          subject: `Tjedni raspored za ${startDate.split('-').reverse().join('.')} - ${endDate.split('-').reverse().join('.')}`,
          html: emailHTML,
        });

        console.log(`Email sent to ${employee.email}:`, emailResponse);
        emailsSent.push(employee.email);

      } catch (empError: any) {
        console.error(`Error processing employee ${employee.id}:`, empError);
      }
    }

    console.log(`Sent ${emailsSent.length} weekly schedule emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: emailsSent.length,
        recipients: emailsSent,
        dateRange: { start: startDate, end: endDate }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-weekly-schedule function:", error);
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
