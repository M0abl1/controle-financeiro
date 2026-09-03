import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Transaction } from "./types";

function transactionCollection(uid: string) {
  if (!db) throw new Error("Firestore não configurado");
  return collection(db, "dados", uid, "lancamentos");
}

export async function listTransactions(uid: string): Promise<Transaction[]> {
  const snapshot = await getDocs(transactionCollection(uid));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        kind: data.kind,
        value: Number(data.value ?? 0),
        description: String(data.description ?? ""),
        category: String(data.category ?? ""),
        pillar: data.pillar,
        date: String(data.date ?? ""),
        reserveId: data.reserveId ? String(data.reserveId) : undefined,
        reserveName: data.reserveName ? String(data.reserveName) : undefined,
        reversed: data.reversed === true,
      } as Transaction;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveTransaction(uid: string, transaction: Transaction) {
  if (!db) throw new Error("Firestore não configurado");
  const data: Record<string, string | number | boolean> = {
    kind: transaction.kind,
    value: transaction.value,
    description: transaction.description,
    category: transaction.category,
    pillar: transaction.pillar,
    date: transaction.date,
    reversed: transaction.reversed === true,
  };
  if (transaction.reserveId && transaction.reserveName) {
    data.reserveId = transaction.reserveId;
    data.reserveName = transaction.reserveName;
  }
  await setDoc(doc(db, "dados", uid, "lancamentos", transaction.id), data);
}

export async function reverseTransaction(uid: string, transactionId: string) {
  if (!db) throw new Error("Firestore não configurado");
  await updateDoc(doc(db, "dados", uid, "lancamentos", transactionId), {
    reversed: true,
  });
}
