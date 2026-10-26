import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const e: EmailRequest = await req.json();
    if (!e?.clientEmail || !e.type) return json({ error: "Nedostaju podaci" }, 400);

    const appUrl = "https://zbrezervacije.info";
    const details = (title: string, firm = "Pružatelj usluge") => ({
      title,
      rows: [
        { label: firm, value: e.businessName },
        { label: "Usluga", value: e.serviceName },
        { label: "Datum", value: e.bookingDate },
        { label: "Vrijeme", value: e.bookingTime },
      ],
    });

    let data: Record<string, unknown>;
    switch (e.type) {
      case "confirmation":
        data = { subject: `Potvrda rezervacije - ${e.businessName}`, heading: "Potvrda rezervacije", greetingName: e.clientName,
          paragraphs: ["Vaša rezervacija je uspješno kreirana!"], blocks: [details("Detalji rezervacije")],
          note: "Ako imate bilo kakvih pitanja, slobodno nas kontaktirajte." };
        break;
      case "reminder":
        data = { subject: `Podsjetnik - Vaš termin kod ${e.businessName}`, heading: "Podsjetnik na termin", greetingName: e.clientName,
          paragraphs: ["Ovo je podsjetnik na vaš nadolazeći termin:"], blocks: [details("Detalji")], note: "Vidimo se uskoro!" };
        break;
      case "no_show_followup":
        data = { subject: `Propušteni termin - ${e.businessName}`, heading: "Propustili ste termin", greetingName: e.clientName,
          paragraphs: ["Primijetili smo da niste došli na zakazani termin:"], blocks: [{ ...details("Detalji propuštenog termina"), tone: "old" }],
          ctaText: "Rezerviraj novi termin", ctaUrl: `${appUrl}/dashboard`,
          note: "Ako ste imali valjani razlog za nedolazak, molimo vas da nas kontaktirate kako bismo to zabilježili." };
        break;
      case "status_change": {
        const st = e.status === "confirmed" ? "potvrđena" : e.status === "cancelled" ? "otkazana" : "ažurirana";
        const rebook = e.status === "cancelled" && e.cancelledByProvider;
        data = { subject: `Promjena statusa rezervacije - ${st}`, heading: `Status rezervacije je ${st}`, greetingName: e.clientName,
          paragraphs: [`Status vaše rezervacije je promijenjen na: ${st}.`, ...(e.cancelledByProvider ? ["Rezervacija je otkazana od strane pružatelja usluge."] : [])],
          blocks: [details("Detalji rezervacije")],
          ...(rebook ? { ctaText: "Rezerviraj novi termin", ctaUrl: `${appUrl}/dashboard` } : {}),
          note: "Ako imate bilo kakvih pitanja, slobodno nas kontaktirajte." };
        break;
      }
      case "client_cancelled":
        data = { subject: "Obavijest: Kupac je otkazao rezervaciju", heading: "Rezervacija je otkazana od strane kupca",
          greetingName: e.providerName || "pružatelju usluge",
          paragraphs: [`Kupac ${e.clientName} je otkazao sljedeću rezervaciju:`], blocks: [{ ...details("Detalji otkazane rezervacije", "Tvrtka"), tone: "old" }],
          note: "Ovaj termin je sada slobodan za druge rezervacije." };
        break;
      case "reschedule_notification":
        data = { subject: "Obavijest: Kupac je promijenio termin rezervacije", heading: "Promjena termina rezervacije", greetingName: e.clientName,
          paragraphs: ["Kupac je promijenio termin rezervacije:"],
          blocks: [
            { title: "Stari termin", tone: "old", rows: [{ label: "Datum", value: e.oldDate || "-" }, { label: "Vrijeme", value: e.oldTime || "-" }] },
            details("Novi termin", "Tvrtka"),
          ] };
        break;
      default:
        return json({ error: "Nepoznata vrsta maila" }, 400);
    }

    try {
      const result = await sendTemplateEmail("booking-notification", e.clientEmail, {
        templateData: data,
        idempotencyKey: e.bookingId ? `booking-${e.type}-${e.bookingId}-${e.status ?? ""}-${e.bookingDate}-${e.bookingTime}` : undefined,
      });
      return json({ success: true, ...result });
    } catch (err: any) {
      console.warn("Email sending failed:", err?.code, err?.message);
      return json({ success: true, skipped: true, message: "Email nije poslan, ali radnja je uspješna." });
    }
  } catch (error: any) {
    console.error("Error in send-booking-email:", error);
    return json({ error: error.message }, 500);
  }
});
