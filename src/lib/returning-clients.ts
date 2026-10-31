export interface ReturningClient {
  name: string;
  phone: string;
  email: string;
}

const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("hr");

export function parseManualClient(notes: string | null): ReturningClient | null {
  if (!notes?.startsWith("[RUČNA REZERVACIJA] Klijent: ")) return null;
  const header = notes.split(/\r?\n/)[0].slice("[RUČNA REZERVACIJA] Klijent: ".length);
  const name = header.split(/, (?:Tel|Email): /)[0].trim();
  if (!name) return null;
  return {
    name,
    phone: header.match(/, Tel: (.*?)(?=, Email: |$)/)?.[1].trim() ?? "",
    email: header.match(/, Email: (.*?)$/)?.[1].trim() ?? "",
  };
}

// Input is newest first. Match contact identities, not names alone, to keep namesakes separate.
export function uniqueReturningClients(clients: ReturningClient[]): ReturningClient[] {
  const result: ReturningClient[] = [];
  for (const client of clients) {
    if (!client.name.trim()) continue;
    const existing = result.find((other) => normalize(other.name) === normalize(client.name) && (
      (client.email && normalize(other.email) === normalize(client.email)) ||
      (client.phone && other.phone.replace(/\D/g, "") === client.phone.replace(/\D/g, "")) ||
      (!client.email && !client.phone && !other.email && !other.phone)
    ));
    if (existing) {
      existing.email ||= client.email;
      existing.phone ||= client.phone;
    } else {
      result.push({ ...client });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "hr"));
}

export function matchingClients(clients: ReturningClient[], query: string): ReturningClient[] {
  const prefix = normalize(query);
  return prefix ? clients.filter((client) => normalize(client.name).startsWith(prefix)) : [];
}