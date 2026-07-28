import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Goal } from "./types";

function reserveCollection(uid: string) {
  if (!db) throw new Error("Firestore não configurado");
  return collection(db, "dados", uid, "reservas");
}

export async function listReserves(uid: string): Promise<Goal[]> {
  const snapshot = await getDocs(reserveCollection(uid));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      name: String(data.name ?? ""),
      value: Number(data.value ?? 0),
      target: Number(data.target ?? 0),
      cdi: Number(data.cdi ?? 100),
    };
  });
}

export async function saveReserve(uid: string, reserve: Goal) {
  if (!db) throw new Error("Firestore não configurado");
  await setDoc(doc(db, "dados", uid, "reservas", reserve.id), {
    name: reserve.name,
    value: reserve.value,
    target: reserve.target,
    cdi: reserve.cdi,
  });
}

export async function removeReserve(uid: string, reserveId: string) {
  if (!db) throw new Error("Firestore não configurado");
  await deleteDoc(doc(db, "dados", uid, "reservas", reserveId));
}
