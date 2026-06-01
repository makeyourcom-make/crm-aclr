/**
 * Génère la page Swiss QR-bill (compliante norme SIX) pour une facture CHF.
 *
 * Utilise `swissqrbill` v4 + `pdfkit` pour produire une page A4 single avec
 * le QR-bill standard suisse (récépissé gauche + section paiement droite).
 *
 * Le PDF retourné peut être mergé avec le PDF de facture via `pdf-lib`.
 */
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Data } from "swissqrbill/types";

export interface QrBillInput {
  amount: number;
  reference?: string;
  creditor: {
    name: string;
    address: string;
    buildingNumber?: string;
    zip: string;
    city: string;
    account: string; // IBAN sans espaces
    country?: string;
  };
  debtor?: {
    name: string;
    address?: string;
    buildingNumber?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  additionalInformation?: string;
}

/**
 * Génère un PDF d'1 page A4 contenant uniquement le QR-bill, et le renvoie
 * comme Buffer.
 */
export async function generateQrBillPdfBuffer(
  input: QrBillInput,
): Promise<Buffer> {
  // Données SwissQRBill : on retire les espaces de l'IBAN (norme demande contigu)
  const ibanClean = input.creditor.account.replace(/\s/g, "");

  const data: Data = {
    amount: input.amount,
    currency: "CHF",
    creditor: {
      name: input.creditor.name.slice(0, 70),
      address: input.creditor.address.slice(0, 70),
      buildingNumber: input.creditor.buildingNumber ?? "",
      zip: input.creditor.zip,
      city: input.creditor.city.slice(0, 35),
      account: ibanClean,
      country: input.creditor.country ?? "CH",
    },
    additionalInformation: input.additionalInformation,
  };
  if (input.debtor && input.debtor.name) {
    data.debtor = {
      name: input.debtor.name.slice(0, 70),
      address: (input.debtor.address ?? "").slice(0, 70),
      buildingNumber: input.debtor.buildingNumber ?? "",
      zip: input.debtor.zip ?? "",
      city: (input.debtor.city ?? "").slice(0, 35),
      country: input.debtor.country ?? "CH",
    };
  }

  // PDFKit a besoin d'un Document A4 vide auquel attacher le QR-bill
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    autoFirstPage: true,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Attache le QR-bill au PDF (positionné en bas par défaut) — langue française
  new SwissQRBill(data, { language: "FR" }).attachTo(doc);
  doc.end();

  return done;
}
