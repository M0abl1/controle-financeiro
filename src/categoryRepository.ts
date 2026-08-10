import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { UserCategory } from "./types";

function categoryCollection(uid: string) {
  if (!db) throw new Error("Firestore não configurado");
  return collection(db, "dados", uid, "categorias");
}

export async function listCategories(uid: string): Promise<UserCategory[]> {
  const snapshot = await getDocs(categoryCollection(uid));
  return snapshot.docs
    .map((item) => ({
      id: item.id,
      name: String(item.data().name ?? ""),
      emoji: String(item.data().emoji ?? "🏷️"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function saveCategory(uid: string, category: UserCategory) {
  if (!db) throw new Error("Firestore não configurado");
  await setDoc(doc(db, "dados", uid, "categorias", category.id), {
    name: category.name,
    emoji: category.emoji,
  });
}

export async function removeCategory(uid: string, categoryId: string) {
  if (!db) throw new Error("Firestore não configurado");
  await deleteDoc(doc(db, "dados", uid, "categorias", categoryId));
}
