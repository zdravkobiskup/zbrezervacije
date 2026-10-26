import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "confirmation" | "status_change" | "reminder" | "no_show_followup" | "client_cancelled" | "reschedule_notification";
  bookingId?: string;
  clientEmail: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  status?: string;
  cancelledByProvider?: boolean;
  appUrl?: string;
  providerName?: string;
  oldDate?: string;
  oldTime?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: EmailRequest = await req.json();
    console.log("Sending email:", emailData);

    let subject = "";
    let html = "";

    const appUrl = emailData.appUrl || "https://zbrezervacije.info";

    switch (emailData.type) {
      case "confirmation":
        subject = `Potvrda rezervacije - ${emailData.businessName}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0D9488;">Potvrda rezervacije</h1>
            <p>Poštovani/a ${emailData.clientName},</p>
            <p>Vaša rezervacija je uspješno kreirana!</p>
            <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #0D9488; margin-top: 0;">Detalji rezervacije:</h2>
              <p><strong>Pružatelj usluge:</strong> ${emailData.businessName}</p>
              <p><strong>Usluga:</strong> ${emailData.serviceName}</p>
              <p><strong>Datum:</strong> ${emailData.bookingDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.bookingTime}</p>
            </div>
            <p>Ako imate bilo kakvih pitanja, slobodno nas kontaktirajte.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Srdačan pozdrav,<br>
              ZB rezervacije tim
            </p>
          </div>
        `;
        break;

      case "reminder":
        subject = `Podsjetnik - Vaš termin kod ${emailData.businessName}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #F97316;">Podsjetnik na termin</h1>
            <p>Poštovani/a ${emailData.clientName},</p>
            <p>Ovo je podsjetnik na vaš nadolazeći termin:</p>
            <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #F97316; margin-top: 0;">Detalji:</h2>
              <p><strong>Pružatelj usluge:</strong> ${emailData.businessName}</p>
              <p><strong>Usluga:</strong> ${emailData.serviceName}</p>
              <p><strong>Datum:</strong> ${emailData.bookingDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.bookingTime}</p>
            </div>
            <p>Vidimo se uskoro!</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Srdačan pozdrav,<br>
              ZB rezervacije tim
            </p>
          </div>
        `;
        break;

      case "no_show_followup":
        subject = `Propušteni termin - ${emailData.businessName}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #EF4444;">Propustili ste termin</h1>
            <p>Poštovani/a ${emailData.clientName},</p>
            <p>Primijetili smo da niste došli na zakazani termin:</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #EF4444; margin-top: 0;">Detalji propuštenog termina:</h2>
              <p><strong>Pružatelj usluge:</strong> ${emailData.businessName}</p>
              <p><strong>Usluga:</strong> ${emailData.serviceName}</p>
              <p><strong>Datum:</strong> ${emailData.bookingDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.bookingTime}</p>
            </div>
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 15px 0; font-size: 16px;">Želite li rezervirati novi termin?</p>
              <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #0D9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Rezerviraj novi termin
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Napomena: Ako ste imali valjani razlog za nedolazak, molimo vas da nas kontaktirate kako bismo to zabilježili.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Srdačan pozdrav,<br>
              ZB rezervacije tim
            </p>
          </div>
        `;
        break;

      case "status_change":
        const statusText = emailData.status === "confirmed" ? "potvrđena" : 
                          emailData.status === "cancelled" ? "otkazana" : "ažurirana";
        const statusColor = emailData.status === "confirmed" ? "#10b981" : 
                           emailData.status === "cancelled" ? "#ef4444" : "#0D9488";
        
        // Add rebooking link if cancelled by provider
        const rebookingSection = (emailData.status === "cancelled" && emailData.cancelledByProvider) ? `
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 16px;">Želite rezervirati novi termin?</p>
            <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #0D9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Rezerviraj novi termin
            </a>
          </div>
        ` : '';
        
        subject = `Promjena statusa rezervacije - ${statusText}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: ${statusColor};">Status rezervacije je ${statusText}</h1>
            <p>Poštovani/a ${emailData.clientName},</p>
            <p>Status vaše rezervacije je promijenjen na: <strong>${statusText}</strong></p>
            ${emailData.cancelledByProvider ? '<p><em>Rezervacija je otkazana od strane pružatelja usluge.</em></p>' : ''}
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: ${statusColor}; margin-top: 0;">Detalji rezervacije:</h2>
              <p><strong>Pružatelj usluge:</strong> ${emailData.businessName}</p>
              <p><strong>Usluga:</strong> ${emailData.serviceName}</p>
              <p><strong>Datum:</strong> ${emailData.bookingDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.bookingTime}</p>
            </div>
            ${rebookingSection}
            <p>Ako imate bilo kakvih pitanja, slobodno nas kontaktirajte.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Srdačan pozdrav,<br>
              ZB rezervacije tim
            </p>
          </div>
        `;
        break;

      case "client_cancelled":
        subject = `Obavijest: Kupac je otkazao rezervaciju`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #EF4444;">Rezervacija je otkazana od strane kupca</h1>
            <p>Poštovani/a ${emailData.providerName || "Pružatelju usluge"},</p>
            <p>Kupac <strong>${emailData.clientName}</strong> je otkazao sljedeću rezervaciju:</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #EF4444; margin-top: 0;">Detalji otkazane rezervacije:</h2>
              <p><strong>Tvrtka:</strong> ${emailData.businessName}</p>
              <p><strong>Usluga:</strong> ${emailData.serviceName}</p>
              <p><strong>Datum:</strong> ${emailData.bookingDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.bookingTime}</p>
            </div>
            <p>Ovaj termin je sada slobodan za druge rezervacije.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Srdačan pozdrav,<br>
              ZB rezervacije tim
            </p>
          </div>
        `;
        break;

      case "reschedule_notification":
        subject = `Obavijest: Kupac je promijenio termin rezervacije`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #F97316;">Promjena termina rezervacije</h1>
            <p>Poštovani/a ${emailData.clientName},</p>
            <p>Kupac je promijenio termin rezervacije:</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #EF4444; margin-top: 0;">Stari termin:</h2>
              <p><strong>Datum:</strong> ${emailData.oldDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.oldTime}</p>
            </div>
            <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #10b981; margin-top: 0;">Novi termin:</h2>
              <p><strong>Tvrtka:</strong> ${emailData.businessName}</p>
              <p><strong>Usluga:</strong> ${emailData.serviceName}</p>
              <p><strong>Datum:</strong> ${emailData.bookingDate}</p>
              <p><strong>Vrijeme:</strong> ${emailData.bookingTime}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Srdačan pozdrav,<br>
              ZB rezervacije tim
            </p>
          </div>
        `;
        break;
    }

    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ZB rezervacije <onboarding@resend.dev>",
          to: [emailData.clientEmail],
          subject: subject,
          html: html,
        }),
      });

      const responseData = await emailResponse.json();
      
      if (!emailResponse.ok) {
        // Check if it's a Resend domain verification error - handle gracefully
        if (responseData.message?.includes("verify a domain") || responseData.message?.includes("testing emails")) {
          console.warn("Resend domain not verified - email skipped:", emailData.clientEmail);
          return new Response(JSON.stringify({ 
            success: true, 
            skipped: true,
            message: "Email skipped - domain not verified in Resend. In-app notification was sent instead."
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }
        throw new Error(responseData.message || "Failed to send email");
      }

      console.log("Email sent successfully:", responseData);

      return new Response(JSON.stringify({ success: true, ...responseData }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (emailError: any) {
      // Handle Resend-specific errors gracefully
      console.warn("Email sending failed, continuing without email:", emailError.message);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        message: "Email could not be sent, but operation completed successfully."
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  } catch (error: any) {
    console.error("Error in send-booking-email function:", error);
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
