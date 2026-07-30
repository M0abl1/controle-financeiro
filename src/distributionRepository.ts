import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Distribution } from "./types";

function distributionRef(uid: string) {
  if (!db) throw new Error("Firestore não configurado");
  return doc(db, "dados", uid, "configuracoes", "distribuicao");
}

export async function getDistribution(uid: string): Promise<Distribution> {
  const snapshot = await getDoc(distributionRef(uid));
  if (!snapshot.exists()) return { reserve: 0, investments: 0 };
  return {
    reserve: Number(snapshot.data().reserve ?? 0),
    investments: Number(snapshot.data().investments ?? 0),
  };
}

export async function saveDistribution(
  uid: string,
  distribution: Distribution,
) {
  await setDoc(distributionRef(uid), distribution);
}
