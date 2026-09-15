import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function validateLoan(item, index) {
  const loan = {
    borrower: String(item.borrower ?? "").trim(),
    description: String(item.description ?? "").trim(),
    value: Number(item.value),
    installments: Number(item.installments),
    startMonth: String(item.startMonth ?? ""),
  };
  if (!loan.borrower || loan.borrower.length > 100)
    throw new Error(`Registro ${index + 1}: nome inválido`);
  if (!loan.description || loan.description.length > 300)
    throw new Error(`Registro ${index + 1}: descrição inválida`);
  if (!Number.isFinite(loan.value) || loan.value <= 0)
    throw new Error(`Registro ${index + 1}: valor inválido`);
  if (!Number.isInteger(loan.installments) || loan.installments < 1 || loan.installments > 600)
    throw new Error(`Registro ${index + 1}: parcelas inválidas`);
  if (!/^\d{4}-\d{2}$/.test(loan.startMonth))
    throw new Error(`Registro ${index + 1}: mês inicial inválido`);
  return loan;
}

function stableId(loan) {
  const fingerprint = [
    loan.borrower.toLocaleLowerCase("pt-BR"),
    loan.description.toLocaleLowerCase("pt-BR"),
    Math.round(loan.value * 100),
    loan.installments,
    loan.startMonth,
  ].join("|");
  return `loan-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 40)}`;
}

const envPath = resolve(argument("--env", ".env.local"));
const dataPath = resolve(argument("--file", "scripts/data/loans-2026-09.json"));
const env = parseEnv(await readFile(envPath, "utf8"));
const email = process.env.LOAN_IMPORT_EMAIL;
const password = process.env.LOAN_IMPORT_PASSWORD;

if (!email || !password) {
  throw new Error(
    "Defina LOAN_IMPORT_EMAIL e LOAN_IMPORT_PASSWORD somente na sessão do terminal.",
  );
}

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
if (!config.apiKey || !config.projectId) throw new Error("Firebase não configurado no arquivo de ambiente.");

const source = JSON.parse(await readFile(dataPath, "utf8"));
if (!Array.isArray(source) || source.length === 0) throw new Error("O arquivo deve conter uma lista de empréstimos.");
const loans = source.map(validateLoan);
const app = initializeApp(config, `loan-import-${Date.now()}`);
const auth = getAuth(app);
const credential = await signInWithEmailAndPassword(auth, email, password);
const db = getFirestore(app);

for (const loan of loans) {
  const id = stableId(loan);
  await setDoc(doc(db, "dados", credential.user.uid, "emprestimos", id), loan);
  console.log(`${id} | ${loan.borrower} | R$ ${loan.value.toFixed(2)}`);
}

await signOut(auth);
console.log(`${loans.length} empréstimo(s) importado(s) sem duplicação.`);
