import {
  collection,
  doc,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import type { MoneyTransfer } from "./types";

const distributionRef = (uid: string) =>
  doc(db!, "dados", uid, "configuracoes", "distribuicao");
const transferRef = (uid: string, id: string) =>
  doc(db!, "dados", uid, "movimentacoes", id);
const goalRef = (uid: string, id: string) =>
  doc(db!, "dados", uid, "reservas", id);

export async function listTransfers(uid: string): Promise<MoneyTransfer[]> {
  if (!db) throw new Error("Firestore não configurado");
  const snapshot = await getDocs(collection(db, "dados", uid, "movimentacoes"));
  return snapshot.docs
    .map((item) => ({
      id: item.id,
      from: item.data().from,
      to: item.data().to,
      value: Number(item.data().value ?? 0),
      date: String(item.data().date ?? ""),
      reversed: item.data().reversed === true,
    })) as MoneyTransfer[];
}

export async function saveMoneyTransfer(
  uid: string,
  movement: MoneyTransfer,
) {
  if (!db) throw new Error("Firestore não configurado");
  await runTransaction(db, async (transaction) => {
    const distributionSnapshot = await transaction.get(distributionRef(uid));
    const next = {
      reserve: Number(distributionSnapshot.data()?.reserve ?? 0),
      investments: Number(distributionSnapshot.data()?.investments ?? 0),
    };
    if (movement.from === "common" && movement.to !== "common")
      next.reserve += movement.value;
    if (movement.to === "common" && movement.from !== "common")
      next.reserve -= movement.value;

    const goalChanges = new Map<string, number>();
    if (movement.from.startsWith("goal:"))
      goalChanges.set(movement.from.slice(5), -movement.value);
    if (movement.to.startsWith("goal:"))
      goalChanges.set(
        movement.to.slice(5),
        (goalChanges.get(movement.to.slice(5)) ?? 0) + movement.value,
      );
    const goalSnapshots = await Promise.all(
      [...goalChanges].map(async ([goalId, delta]) => ({
        delta,
        reference: goalRef(uid, goalId),
        snapshot: await transaction.get(goalRef(uid, goalId)),
      })),
    );
    for (const { delta, reference, snapshot } of goalSnapshots) {
      if (!snapshot.exists()) throw new Error("Cofrinho não encontrado.");
      const value = Number(snapshot.data().value ?? 0) + delta;
      if (value < 0) throw new Error("Saldo insuficiente no cofrinho.");
      transaction.update(reference, { value });
    }
    if (next.reserve < 0) throw new Error("Saldo insuficiente na Reserva.");
    transaction.set(distributionRef(uid), next);
    transaction.set(transferRef(uid, movement.id), movement);
  });
}

export async function reverseMoneyTransfer(
  uid: string,
  movement: MoneyTransfer,
) {
  if (movement.reversed) return;
  await saveMoneyTransfer(
    uid,
    {
      ...movement,
      id: crypto.randomUUID(),
      from: movement.to,
      to: movement.from,
      reversed: false,
    },
  );
  if (!db) throw new Error("Firestore não configurado");
  await runTransaction(db, async (transaction) => {
    transaction.update(transferRef(uid, movement.id), { reversed: true });
  });
}
