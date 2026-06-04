/**
 * Génération d'un flux iCalendar (RFC 5545) à partir des activités CRM.
 *
 * Utilisé par /api/calendar/feed/[token].ics pour exposer un agenda
 * abonnable depuis Infomaniak, Apple Calendar, Google Calendar, etc.
 */

interface ActivityForIcs {
  id: string;
  type: string;
  sujet: string;
  contenu: string | null;
  adresseRdv: string | null;
  date: Date;
  duree: number | null; // minutes
  duree2: number | null; // secondes (durée effective click-to-call)
  statut: string;
  prospect: { id: string; raisonSociale: string } | null;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Échappe une valeur pour un champ iCalendar.
 * RFC 5545 §3.3.11 : escape \, ; , et les retours ligne.
 */
function escapeIcsText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Formatage UTC en YYYYMMDDTHHMMSSZ (RFC 5545 §3.3.5)
 */
function toIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Fold lignes >75 caractères (RFC 5545 §3.1) : insère CRLF + 1 espace.
 * Apple Calendar et Infomaniak sont stricts là-dessus.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = " " + rest.slice(75); // continuation préfixée d'un espace
  }
  out.push(rest);
  return out.join("\r\n");
}

const TYPE_LABEL: Record<string, string> = {
  RDV_PHYSIQUE: "RDV",
  RDV_VISIO: "Visio",
  RDV_TELEPHONIQUE: "RDV tél.",
  APPEL_SORTANT: "Appel",
  APPEL_ENTRANT: "Appel reçu",
  EMAIL_ENVOYE: "Email",
  EMAIL_RECU: "Email reçu",
  SMS: "SMS",
  LINKEDIN: "LinkedIn",
  NOTE: "Note",
};

/**
 * Génère le contenu .ics complet pour un ensemble d'activités.
 *
 * @param activities  Liste des activités à exposer
 * @param appUrl      Base URL de l'app (ex. https://crm.makeyourcom.ch) pour
 *                    générer les liens URL dans les events
 * @param ownerName   Nom du propriétaire (apparaît dans X-WR-CALNAME)
 */
export function buildCalendarIcs(
  activities: ActivityForIcs[],
  appUrl: string,
  ownerName: string,
): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Make Your Com//CRM ACLR//FR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(fold(`X-WR-CALNAME:CRM — ${escapeIcsText(ownerName)}`));
  lines.push("X-WR-TIMEZONE:Europe/Zurich");
  lines.push(
    fold(`X-WR-CALDESC:Agenda du CRM Make Your Com pour ${escapeIcsText(ownerName)}`),
  );

  for (const a of activities) {
    // Durée : préférence à duree (déclarée), sinon duree2 (sec→min), sinon 30min
    const dureeMin = a.duree ?? (a.duree2 ? Math.round(a.duree2 / 60) : 30);
    const dtStart = a.date;
    const dtEnd = new Date(dtStart.getTime() + dureeMin * 60 * 1000);
    // SUMMARY = "[Type] Sujet" (+ raison sociale si prospect)
    const prefix = TYPE_LABEL[a.type] ?? a.type;
    const clientPart = a.prospect ? ` — ${a.prospect.raisonSociale}` : "";
    const summary = `[${prefix}]${clientPart} ${a.sujet}`.trim();

    // Description : sujet + notes + lien vers fiche
    const descParts: string[] = [];
    if (a.contenu) descParts.push(a.contenu);
    if (a.adresseRdv) descParts.push(`Lieu/lien: ${a.adresseRdv}`);
    if (a.prospect) {
      descParts.push(`Fiche client: ${appUrl}/prospects/${a.prospect.id}`);
    }
    descParts.push(`Statut: ${a.statut}`);

    // LOCATION : adresseRdv si renseigné (peut être URL aussi, c'est OK)
    const location = a.adresseRdv ?? "";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:activity-${a.id}@crm.makeyourcom.ch`);
    lines.push(`DTSTAMP:${toIcsDate(a.updatedAt ?? new Date())}`);
    lines.push(`DTSTART:${toIcsDate(dtStart)}`);
    lines.push(`DTEND:${toIcsDate(dtEnd)}`);
    lines.push(fold(`SUMMARY:${escapeIcsText(summary)}`));
    if (descParts.length > 0) {
      lines.push(fold(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`));
    }
    if (location) {
      lines.push(fold(`LOCATION:${escapeIcsText(location)}`));
    }
    // Lien vers le CRM (fiche ou agenda)
    const detailUrl = a.prospect
      ? `${appUrl}/prospects/${a.prospect.id}`
      : `${appUrl}/agenda`;
    lines.push(fold(`URL:${detailUrl}`));
    // Statut iCal :
    //   PLANIFIE / EN_COURS → CONFIRMED
    //   ANNULE → CANCELLED
    //   sinon (FAIT, MANQUE, REPLANIFIE) → CONFIRMED (historique gardé)
    const icsStatus =
      a.statut === "ANNULE" ? "CANCELLED" : "CONFIRMED";
    lines.push(`STATUS:${icsStatus}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
