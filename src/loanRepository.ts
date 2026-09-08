import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Loan } from "./types";

function loanCollection(uid: string) {
  if (!db) throw new Error("Firestore não configurado");
  return collection(db, "dados", uid, "emprestimos");
}

export async function listLoans(uid: string): Promise<Loan[]> {
  const snapshot = await getDocs(loanCollection(uid));
  return snapshot.docs
    .map((item) => ({
      id: item.id,
      description: String(item.data().description ?? ""),
      borrower: String(item.data().borrower ?? ""),
      value: Number(item.data().value ?? 0),
      installments: Number(item.data().installments ?? 1),
      startMonth: String(
        item.data().startMonth ?? new Date().toISOString().slice(0, 7),
      ),
    }))
    .sort((a, b) => a.borrower.localeCompare(b.borrower, "pt-BR"));
}

export async function saveLoan(uid: string, loan: Loan) {
  if (!db) throw new Error("Firestore não configurado");
  await setDoc(doc(db, "dados", uid, "emprestimos", loan.id), {
    description: loan.description,
    borrower: loan.borrower,
    value: loan.value,
    installments: loan.installments,
    startMonth: loan.startMonth,
  });
}

export async function removeLoan(uid: string, loanId: string) {
  if (!db) throw new Error("Firestore não configurado");
  await deleteDoc(doc(db, "dados", uid, "emprestimos", loanId));
}
