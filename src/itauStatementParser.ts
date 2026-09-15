import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { StatementConfig, Transaction } from "./types";

const parseCurrency = (value: string) =>
  Number(value.replace(/\./g, "").replace(",", "."));

const isoDate = (value: string) => {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
};

async function hash(value: string | Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    typeof value === "string" ? new TextEncoder().encode(value) : value,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function pageLines(items: TextItem[]) {
  const rows = new Map<number, TextItem[]>();
  items.forEach((item) => {
    const y = Math.round(item.transform[5]);
    const existing = [...rows.keys()].find((key) => Math.abs(key - y) <= 2);
    const key = existing ?? y;
    rows.set(key, [...(rows.get(key) ?? []), item]);
  });
  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) =>
      row
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

export async function parseItauStatement(file: File): Promise<{
  config: StatementConfig;
  transactions: Transaction[];
}> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = workerUrl;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("Selecione um arquivo PDF.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("O PDF deve ter no máximo 15 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sourceHash = await hash(bytes);
  const pdf = await getDocument({ data: bytes }).promise;
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...pageLines(content.items.filter((item): item is TextItem => "str" in item)));
  }
  const fullText = lines.join("\n");
  if (!/extrato conta\s*\/\s*lançamentos/i.test(fullText))
    throw new Error("Este PDF não corresponde ao modelo de extrato Itaú esperado.");

  const balanceMatch = fullText.match(/R\$\s*([\d.]+,\d{2})/);
  const periodMatch = fullText.match(
    /período de visualização:\s*(\d{2}\/\d{2}\/\d{4})\s*até\s*(\d{2}\/\d{2}\/\d{4})/i,
  );
  if (!balanceMatch) throw new Error("Não foi possível identificar o saldo do extrato.");

  const occurrences = new Map<string, number>();
  const transactions: Transaction[] = [];
  for (const line of lines) {
    const match = line.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})(?:\s+[\d.]+,\d{2})?$/,
    );
    if (!match || /^SALDO DO DIA$/i.test(match[2].trim())) continue;
    const signedValue = parseCurrency(match[3]);
    if (!Number.isFinite(signedValue) || signedValue === 0) continue;
    const date = isoDate(match[1]);
    const description = match[2].trim();
    const fingerprint = `${date}|${description.toLocaleUpperCase()}|${Math.round(signedValue * 100)}`;
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    transactions.push({
      id: `itau-${(await hash(`${fingerprint}|${occurrence}`)).slice(0, 40)}`,
      kind: signedValue > 0 ? "income" : "expense",
      value: Math.abs(signedValue),
      description,
      category: "Não categorizado",
      pillar: "common",
      date,
      reversed: false,
    });
  }
  if (transactions.length === 0)
    throw new Error("Nenhum lançamento foi encontrado no extrato.");

  return {
    config: {
      balance: parseCurrency(balanceMatch[1]),
      importedAt: new Date().toISOString(),
      periodStart: periodMatch ? isoDate(periodMatch[1]) : "",
      periodEnd: periodMatch ? isoDate(periodMatch[2]) : "",
      sourceHash,
    },
    transactions,
  };
}
