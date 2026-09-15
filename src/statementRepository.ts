import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { StatementConfig, Transaction } from "./types";

const configRef = (uid: string) =>
  doc(db!, "dados", uid, "configuracoes", "extrato");

export async function getStatementConfig(uid: string): Promise<StatementConfig | null> {
  if (!db) throw new Error("Firestore não configurado");
  const snapshot = await getDoc(configRef(uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    balance: Number(data.balance ?? 0),
    importedAt: String(data.importedAt ?? ""),
    periodStart: String(data.periodStart ?? ""),
    periodEnd: String(data.periodEnd ?? ""),
    sourceHash: String(data.sourceHash ?? ""),
  };
}

export async function importStatement(
  uid: string,
  config: StatementConfig,
  transactions: Transaction[],
) {
  if (!db) throw new Error("Firestore não configurado");
  const existing = await getDocs(collection(db, "dados", uid, "lancamentos"));
  const existingIds = new Set(existing.docs.map((item) => item.id));
  const newTransactions = transactions.filter((item) => !existingIds.has(item.id));
  for (let offset = 0; offset < newTransactions.length; offset += 400) {
    const batch = writeBatch(db);
    newTransactions.slice(offset, offset + 400).forEach((transaction) => {
      batch.set(doc(db!, "dados", uid, "lancamentos", transaction.id), {
        kind: transaction.kind,
        value: transaction.value,
        description: transaction.description,
        category: transaction.category,
        pillar: transaction.pillar,
        date: transaction.date,
        reversed: false,
      });
    });
    await batch.commit();
  }
  await setDoc(configRef(uid), config);
  return {
    imported: newTransactions.length,
    skipped: transactions.length - newTransactions.length,
  };
}
