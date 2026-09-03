import { useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  Download,
  Home,
  Landmark,
  ListFilter,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Target,
  Tags,
  TrendingUp,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import type { User } from "firebase/auth";
import {
  categories as defaultCategories,
  seedAssets,
  seedGoals,
  seedTransactions,
} from "./data";
import { setAccountPassword } from "./firebase";
import { listReserves, removeReserve, saveReserve } from "./reserveRepository";
import { listTransactions, saveTransaction } from "./transactionRepository";
import { getDistribution, saveDistribution } from "./distributionRepository";
import {
  listCategories,
  removeCategory,
  saveCategory,
} from "./categoryRepository";
import type {
  Distribution,
  EntryKind,
  Goal,
  Pillar,
  Transaction,
  UserCategory,
} from "./types";

type View =
  | "home"
  | "transactions"
  | "common"
  | "reserve"
  | "investments"
  | "categories"
  | "settings";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const localDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const colors = [
  "#8b5cf6",
  "#3b82f6",
  "#a78bfa",
  "#6366f1",
  "#60a5fa",
  "#c084fc",
  "#64748b",
];
const categoryIconLibrary = [
  "🏷️",
  "🛒",
  "🏠",
  "🧾",
  "🍽️",
  "🚗",
  "⛽",
  "🚌",
  "💊",
  "🏥",
  "🎓",
  "📚",
  "💻",
  "📱",
  "🎮",
  "🎬",
  "🎵",
  "🏋️",
  "🐾",
  "✈️",
  "🎁",
  "👕",
  "💇",
  "🔧",
  "💡",
  "💳",
  "💰",
  "📈",
  "❤️",
  "⭐",
];

function CategoryIcon({ icon }: { icon: string }) {
  return icon.startsWith("data:image/") ? (
    <img src={icon} alt="" />
  ) : (
    <>{icon}</>
  );
}

function resizeCategoryImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("Formato não permitido"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error("Imagem maior que 2 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Imagem inválida"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 96;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas indisponível"));
          return;
        }
        const scale = Math.min(96 / image.width, 96 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.clearRect(0, 0, 96, 96);
        context.drawImage(
          image,
          (96 - width) / 2,
          (96 - height) / 2,
          width,
          height,
        );
        const result = canvas.toDataURL("image/webp", 0.82);
        if (result.length > 150000) {
          reject(new Error("Imagem processada muito grande"));
          return;
        }
        resolve(result);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
const nav = [
  { id: "home", label: "Início", icon: Home },
  { id: "transactions", label: "Transações", icon: ListFilter },
  { id: "common", label: "Uso comum", icon: WalletCards },
  { id: "reserve", label: "Reserva", icon: Shield },
  { id: "investments", label: "Investimentos", icon: TrendingUp },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "settings", label: "Configurações", icon: Settings },
] as const;

export default function App({
  currentUser,
  onLogout,
}: {
  currentUser?: User;
  onLogout?: () => Promise<void>;
}) {
  const [view, setView] = useState<View>("home");
  const [transactions, setTransactions] =
    useState<Transaction[]>(seedTransactions);
  const [modal, setModal] = useState<EntryKind | null>(null);
  const [distributionModal, setDistributionModal] = useState(false);
  const [distribution, setDistribution] = useState<Distribution>({
    reserve: 0,
    investments: 0,
  });
  const [goals, setGoals] = useState<Goal[]>(seedGoals);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [reserveSyncError, setReserveSyncError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const refreshCloudData = async () => {
      try {
        const [
          cloudReserves,
          cloudTransactions,
          cloudDistribution,
          cloudCategories,
        ] = await Promise.all([
          listReserves(currentUser.uid),
          listTransactions(currentUser.uid),
          getDistribution(currentUser.uid),
          listCategories(currentUser.uid),
        ]);
        if (!active) return;
        setGoals(cloudReserves);
        setTransactions(cloudTransactions);
        setDistribution(cloudDistribution);
        setUserCategories(cloudCategories);
        setReserveSyncError("");
      } catch {
        if (active)
          setReserveSyncError(
            "Não foi possível sincronizar os dados do Firestore.",
          );
      }
    };
    void refreshCloudData();
    const interval = window.setInterval(refreshCloudData, 15000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCloudData();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [currentUser]);

  const persistReserve = async (goal: Goal) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    await saveReserve(currentUser.uid, goal);
    setGoals((current) => {
      const exists = current.some((item) => item.id === goal.id);
      return exists
        ? current.map((item) => (item.id === goal.id ? goal : item))
        : [...current, goal];
    });
    setReserveSyncError("");
  };

  const deleteReserve = async (goalId: string) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    await removeReserve(currentUser.uid, goalId);
    setGoals((current) => current.filter((item) => item.id !== goalId));
  };
  const income = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "income")
        .reduce((s, t) => s + t.value, 0),
    [transactions],
  );
  const expensesByPillar = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.kind === "expense" && transaction.date <= localDate(),
        )
        .reduce(
          (total, transaction) => {
            total[transaction.pillar] += transaction.value;
            return total;
          },
          { common: 0, reserve: 0, investments: 0 } as Record<Pillar, number>,
        ),
    [transactions],
  );
  const futureExpensesByPillar = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.kind === "expense" && transaction.date > localDate(),
        )
        .reduce(
          (total, transaction) => {
            total[transaction.pillar] += transaction.value;
            return total;
          },
          { common: 0, reserve: 0, investments: 0 } as Record<Pillar, number>,
        ),
    [transactions],
  );
  const allocated = {
    reserve: Math.max(0, distribution.reserve),
    investments: Math.max(0, distribution.investments),
    common: Math.max(
      0,
      income - distribution.reserve - distribution.investments,
    ),
  };
  const balances = {
    common: allocated.common - expensesByPillar.common,
    reserve:
      allocated.reserve -
      expensesByPillar.reserve +
      goals.reduce((s, g) => s + g.value, 0),
    investments:
      allocated.investments -
      expensesByPillar.investments +
      seedAssets.reduce((s, a) => s + a.currentPrice * a.quantity, 0),
  };
  const total = balances.common + balances.reserve + balances.investments;
  const projectedBalances = {
    common: balances.common - futureExpensesByPillar.common,
    reserve: balances.reserve - futureExpensesByPillar.reserve,
    investments: balances.investments - futureExpensesByPillar.investments,
  };
  const projectedTotal =
    projectedBalances.common +
    projectedBalances.reserve +
    projectedBalances.investments;
  const addTransaction = async (entry: Omit<Transaction, "id">) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    if (entry.kind === "expense" && entry.reserveId) {
      const reserve = goals.find((goal) => goal.id === entry.reserveId);
      if (!reserve) throw new Error("A reserva selecionada não existe mais.");
      const committed = transactions
        .filter(
          (transaction) =>
            transaction.kind === "expense" &&
            transaction.reserveId === entry.reserveId,
        )
        .reduce((sum, transaction) => sum + transaction.value, 0);
      const available = Math.max(0, reserve.value - committed);
      if (entry.value > available) {
        throw new Error(
          `Saldo insuficiente em ${reserve.name}. Disponível: ${money.format(available)}.`,
        );
      }
    }
    const transaction = { ...entry, id: crypto.randomUUID() };
    await saveTransaction(currentUser.uid, transaction);
    setTransactions((current) => [transaction, ...current]);
  };
  const importTransactions = async (items: Transaction[]) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    await Promise.all(
      items.map((item) => saveTransaction(currentUser.uid, item)),
    );
    setTransactions(items);
  };
  const persistDistribution = async (next: Distribution) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    await saveDistribution(currentUser.uid, next);
    setDistribution(next);
    setReserveSyncError("");
  };
  const persistCategory = async (category: UserCategory) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    await saveCategory(currentUser.uid, category);
    setUserCategories((current) => {
      const exists = current.some((item) => item.id === category.id);
      return exists
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category].sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR"),
          );
    });
  };
  const deleteCategory = async (categoryId: string) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
    await removeCategory(currentUser.uid, categoryId);
    setUserCategories((current) =>
      current.filter((item) => item.id !== categoryId),
    );
  };
  const categoryOptions = useMemo(() => {
    const options: Array<readonly [string, string]> = [...defaultCategories];
    const names = new Set(options.map(([name]) => name.toLocaleLowerCase()));
    userCategories.forEach((category) => {
      if (!names.has(category.name.toLocaleLowerCase())) {
        options.push([category.name, category.emoji]);
        names.add(category.name.toLocaleLowerCase());
      }
    });
    return options;
  }, [userCategories]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>MC</span>
          <div>
            Meu Controle<small>Finanças sob seu controle</small>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
              key={n.id}
            >
              <n.icon size={19} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sync">
          <span></span>Dados sincronizados com sua conta
        </div>
      </aside>
      <main>
        <header>
          <div>
            <button className="mobile-menu">
              <Menu />
            </button>
            <p>VISÃO FINANCEIRA</p>
            <h1>{nav.find((n) => n.id === view)?.label}</h1>
          </div>
          <div className="user-menu">
            <div>
              <b>{currentUser?.displayName || "Usuário"}</b>
              <small>{currentUser?.email}</small>
            </div>
            {currentUser?.photoURL ? (
              <img
                className="avatar"
                src={currentUser.photoURL}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="avatar">DO</div>
            )}
            <button onClick={onLogout} title="Sair">
              <LogOut />
            </button>
          </div>
        </header>
        <nav className="view-tabs" aria-label="Seções financeiras">
          {nav.map((item) => (
            <button
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
              key={item.id}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        {view === "home" && (
          <HomeView
            total={total}
            projectedTotal={projectedTotal}
            balances={balances}
            projectedBalances={projectedBalances}
            income={income}
            commonAllocated={allocated.common}
            commonExpense={expensesByPillar.common}
            transactions={transactions}
            setModal={setModal}
            onDistribute={() => setDistributionModal(true)}
          />
        )}
        {view === "transactions" && (
          <TransactionsView
            transactions={transactions}
            categories={categoryOptions}
            onNewTransaction={() => setModal("expense")}
          />
        )}
        {view === "common" && (
          <CommonView
            transactions={transactions}
            categories={categoryOptions}
            search={search}
            setSearch={setSearch}
            budget={allocated.common}
          />
        )}
        {view === "reserve" && (
          <ReserveView
            goals={goals}
            transactions={transactions}
            balance={balances.reserve}
            projectedBalance={projectedBalances.reserve}
            onSave={persistReserve}
            onDelete={deleteReserve}
            syncError={reserveSyncError}
          />
        )}
        {view === "investments" && (
          <InvestmentsView
            freeCash={allocated.investments - expensesByPillar.investments}
          />
        )}
        {view === "categories" && (
          <CategoriesView
            defaultCategories={defaultCategories}
            userCategories={userCategories}
            onSave={persistCategory}
            onDelete={deleteCategory}
          />
        )}
        {view === "settings" && (
          <SettingsView
            transactions={transactions}
            setTransactions={importTransactions}
          />
        )}
      </main>
      <div className="fab">
        <button
          className="expense"
          onClick={() => setModal("expense")}
          aria-label="Nova saída"
        >
          <ArrowUpRight />
        </button>
        <button
          className="income"
          onClick={() => setModal("income")}
          aria-label="Nova entrada"
        >
          <Plus />
        </button>
      </div>
      <nav className="bottom-nav">
        {nav.slice(0, 4).map((n) => (
          <button
            className={view === n.id ? "active" : ""}
            onClick={() => setView(n.id)}
            key={n.id}
          >
            <n.icon />
            <span>{n.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
      {modal && (
        <TransactionModal
          kind={modal}
          categories={categoryOptions}
          goals={goals}
          close={() => setModal(null)}
          submit={addTransaction}
        />
      )}
      {distributionModal && (
        <DistributionModal
          current={distribution}
          commonBalance={balances.common}
          reserveBalance={balances.reserve}
          close={() => setDistributionModal(false)}
          submit={persistDistribution}
        />
      )}
    </div>
  );
}

function HomeView({
  total,
  projectedTotal,
  balances,
  projectedBalances,
  income,
  commonAllocated,
  commonExpense,
  transactions,
  setModal,
  onDistribute,
}: {
  total: number;
  projectedTotal: number;
  balances: Record<Pillar, number>;
  projectedBalances: Record<Pillar, number>;
  income: number;
  commonAllocated: number;
  commonExpense: number;
  transactions: Transaction[];
  setModal: (v: EntryKind) => void;
  onDistribute: () => void;
}) {
  return (
    <section className="page">
      <div className="overview-grid">
        <article className="hero">
          <div>
            <span>VISÃO GERAL DO PATRIMÔNIO</span>
            <h2>Seu dinheiro pode trabalhar melhor por você.</h2>
            <p>
              Acompanhe o saldo atual, organize os setores e antecipe o impacto
              dos seus gastos agendados.
            </p>
            <div className="hero-balance">
              <small>Saldo atual</small>
              <strong>{money.format(total)}</strong>
            </div>
            <div className="projected-total">
              <CalendarClock size={14} />
              <span>
                Após gastos agendados <b>{money.format(projectedTotal)}</b>
              </span>
            </div>
          </div>
        </article>
        <article className="panel home-summary">
          <div className="panel-head">
            <div>
              <span>RITMO DE GASTOS</span>
              <h2>{money.format(commonExpense)}</h2>
            </div>
            <TrendingUp />
          </div>
          <p>Saídas confirmadas no Uso comum</p>
          <div className="spending-track">
            <i
              style={{
                width: `${Math.min(commonAllocated ? (commonExpense / commonAllocated) * 100 : 0, 100)}%`,
              }}
            />
          </div>
          <div className="summary-stats">
            <div>
              <small>Receitas</small>
              <b>{money.format(income)}</b>
            </div>
            <div>
              <small>Agendado</small>
              <b>{money.format(Math.max(0, total - projectedTotal))}</b>
            </div>
            <div>
              <small>Lançamentos</small>
              <b>{transactions.length}</b>
            </div>
          </div>
        </article>
      </div>
      <div className="pillar-grid">
        <PillarCard
          title="Uso comum"
          percent="Saldo"
          value={balances.common}
          projectedValue={projectedBalances.common}
          icon={<WalletCards />}
          color="green"
          subtitle={`${money.format(commonExpense)} gastos no pilar`}
          progress={
            commonAllocated ? (commonExpense / commonAllocated) * 100 : 0
          }
        />
        <PillarCard
          title="Reserva"
          percent="Definido"
          value={balances.reserve}
          projectedValue={projectedBalances.reserve}
          icon={<Shield />}
          color="purple"
          subtitle="Reserva + objetivos"
          progress={income ? (Math.max(0, balances.reserve) / income) * 100 : 0}
        />
        <PillarCard
          title="Investimentos"
          percent="Definido"
          value={balances.investments}
          projectedValue={projectedBalances.investments}
          icon={<TrendingUp />}
          color="amber"
          subtitle="Carteira + caixa livre"
          progress={
            income ? (Math.max(0, balances.investments) / income) * 100 : 0
          }
        />
      </div>
      <div className="content-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <span>MOVIMENTAÇÕES</span>
              <h2>Últimos lançamentos</h2>
            </div>
            <BarChart3 />
          </div>
          <TransactionList transactions={transactions.slice(0, 5)} />
        </article>
        <article className="panel quick">
          <div className="panel-head">
            <div>
              <span>ATALHOS</span>
              <h2>Lançamento rápido</h2>
            </div>
          </div>
          <button onClick={() => setModal("income")}>
            <ArrowDownLeft />
            <div>
              <strong>Registrar entrada</strong>
              <small>Valor total entra em Uso comum</small>
            </div>
          </button>
          <button onClick={onDistribute}>
            <Landmark />
            <div>
              <strong>Mover dinheiro</strong>
              <small>Transfira entre Uso comum e Reserva</small>
            </div>
          </button>
          <button onClick={() => setModal("expense")}>
            <CalendarClock />
            <div>
              <strong>Registrar ou agendar saída</strong>
              <small>Escolha hoje ou uma data futura</small>
            </div>
          </button>
        </article>
      </div>
    </section>
  );
}
function PillarCard({
  title,
  percent,
  value,
  projectedValue,
  icon,
  color,
  subtitle,
  progress,
}: {
  title: string;
  percent: string;
  value: number;
  projectedValue: number;
  icon: React.ReactNode;
  color: string;
  subtitle: string;
  progress: number;
}) {
  return (
    <article className={`pillar ${color}`}>
      <div className="pillar-top">
        <span className="pillar-icon">{icon}</span>
        <b>{percent}</b>
      </div>
      <small>{title.toUpperCase()}</small>
      <span className="balance-label">Saldo atual</span>
      <strong>{money.format(value)}</strong>
      <div className="projected-balance">
        <span>Após gastos agendados</span>
        <b>{money.format(projectedValue)}</b>
      </div>
      <div className="progress">
        <i style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <p>{subtitle}</p>
    </article>
  );
}

function TransactionsView({
  transactions,
  categories,
  onNewTransaction,
}: {
  transactions: Transaction[];
  categories: ReadonlyArray<readonly [string, string]>;
  onNewTransaction: () => void;
}) {
  const today = localDate();
  const [startDate, setStartDate] = useState(`${today.slice(0, 8)}01`);
  const [endDate, setEndDate] = useState(today);
  const [kind, setKind] = useState<"all" | EntryKind>("all");
  const [pillar, setPillar] = useState<"all" | Pillar>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "highest">("newest");
  const [query, setQuery] = useState("");
  const categoryNames = Array.from(
    new Set([
      ...categories.map(([name]) => name),
      ...transactions.map((transaction) => transaction.category),
    ]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = transactions
    .filter(
      (transaction) =>
        (!startDate || transaction.date >= startDate) &&
        (!endDate || transaction.date <= endDate) &&
        (kind === "all" || transaction.kind === kind) &&
        (pillar === "all" || transaction.pillar === pillar) &&
        (category === "all" || transaction.category === category) &&
        `${transaction.description} ${transaction.category}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "highest") return b.value - a.value;
      return sort === "oldest"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    });
  const income = filtered
    .filter((transaction) => transaction.kind === "income")
    .reduce((total, transaction) => total + transaction.value, 0);
  const expense = filtered
    .filter((transaction) => transaction.kind === "expense")
    .reduce((total, transaction) => total + transaction.value, 0);

  return (
    <section className="page transactions-page">
      <div className="transaction-filters">
        <label>
          <CalendarDays />
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-label="Data inicial"
          />
          <span>até</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-label="Data final"
          />
        </label>
        <select
          value={pillar}
          onChange={(event) => setPillar(event.target.value as "all" | Pillar)}
          aria-label="Filtrar por setor"
        >
          <option value="all">Todos os setores</option>
          <option value="common">Uso comum</option>
          <option value="reserve">Reserva</option>
          <option value="investments">Investimentos</option>
        </select>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "all" | EntryKind)}
          aria-label="Filtrar por tipo"
        >
          <option value="all">Todas as transações</option>
          <option value="income">Somente entradas</option>
          <option value="expense">Somente saídas</option>
        </select>
        <select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as "newest" | "oldest" | "highest")
          }
          aria-label="Ordenar transações"
        >
          <option value="newest">Data: mais recentes</option>
          <option value="oldest">Data: mais antigas</option>
          <option value="highest">Maior valor</option>
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filtrar por categoria"
        >
          <option value="all">Todas as categorias</option>
          {categoryNames.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="transaction-summary-grid">
        <Metric label="TOTAL" value={String(filtered.length)} />
        <Metric label="DESPESAS" value={money.format(expense)} />
        <Metric label="RECEITAS" value={money.format(income)} />
        <Metric label="SALDO" value={money.format(income - expense)} />
      </div>
      <article className="panel transaction-table-panel">
        <div className="transaction-table-tools">
          <label className="search">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar transações..."
            />
          </label>
          <button className="primary" onClick={onNewTransaction}>
            <Plus /> Nova transação
          </button>
        </div>
        <div className="table-wrap">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Setor</th>
                <th>Data</th>
                <th>Status</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Nenhuma transação encontrada com estes filtros.
                  </td>
                </tr>
              )}
              {filtered.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <span className={`table-kind ${transaction.kind}`}>
                      {transaction.kind === "income" ? "↙" : "↗"}
                    </span>
                    <b>{transaction.description}</b>
                  </td>
                  <td>
                    <span className="category-chip">
                      {transaction.category}
                    </span>
                  </td>
                  <td>
                    {pillarLabel(transaction.pillar)}
                    {transaction.reserveName && (
                      <small className="table-secondary">
                        {transaction.reserveName}
                      </small>
                    )}
                  </td>
                  <td>
                    {new Date(
                      `${transaction.date}T12:00:00`,
                    ).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <span
                      className={`transaction-status ${transaction.date > today ? "scheduled" : "confirmed"}`}
                    >
                      {transaction.date > today ? "Agendada" : "Confirmada"}
                    </span>
                  </td>
                  <td
                    className={
                      transaction.kind === "income" ? "positive" : "negative"
                    }
                  >
                    {transaction.kind === "income" ? "+" : "−"}
                    {money.format(transaction.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function pillarLabel(pillar: Pillar) {
  if (pillar === "reserve") return "Reserva";
  if (pillar === "investments") return "Investimentos";
  return "Uso comum";
}

function CategoriesView({
  defaultCategories,
  userCategories,
  onSave,
  onDelete,
}: {
  defaultCategories: ReadonlyArray<readonly [string, string]>;
  userCategories: UserCategory[];
  onSave: (category: UserCategory) => Promise<void>;
  onDelete: (categoryId: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <section className="page">
      <div className="section-actions category-heading">
        <div>
          <span>CATEGORIAS</span>
          <h2>Minhas categorias</h2>
          <p>Categorias pessoais aparecem somente na sua conta.</p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus /> Nova categoria
        </button>
      </div>
      <article className="panel category-library">
        <div className="category-section-title">
          <div>
            <span>PADRÕES DO SISTEMA</span>
            <small>{defaultCategories.length} categorias disponíveis</small>
          </div>
        </div>
        <div className="category-card-grid">
          {defaultCategories.map(([name, emoji]) => (
            <div className="category-card" key={name}>
              <span>
                <CategoryIcon icon={emoji} />
              </span>
              <div>
                <b>{name}</b>
                <small>Padrão</small>
              </div>
            </div>
          ))}
        </div>
        <div className="category-section-title personal">
          <div>
            <span>MINHAS CATEGORIAS</span>
            <small>{userCategories.length} categorias pessoais</small>
          </div>
        </div>
        {userCategories.length === 0 ? (
          <div className="category-empty">
            <Tags />
            <p>Você ainda não criou uma categoria pessoal.</p>
          </div>
        ) : (
          <div className="category-card-grid">
            {userCategories.map((category) => (
              <div className="category-card personal" key={category.id}>
                <span>
                  <CategoryIcon icon={category.emoji} />
                </span>
                <div>
                  <b>{category.name}</b>
                  <small>Pessoal</small>
                </div>
                <button
                  className="category-delete"
                  onClick={async () => {
                    if (!confirm(`Excluir a categoria "${category.name}"?`))
                      return;
                    try {
                      await onDelete(category.id);
                    } catch {
                      alert("Não foi possível excluir a categoria.");
                    }
                  }}
                  aria-label={`Excluir ${category.name}`}
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        )}
      </article>
      {creating && (
        <CategoryModal
          existingNames={[
            ...defaultCategories.map(([name]) => name),
            ...userCategories.map((category) => category.name),
          ]}
          close={() => setCreating(false)}
          submit={async (category) => {
            await onSave(category);
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}

function CategoryModal({
  existingNames,
  close,
  submit,
}: {
  existingNames: string[];
  close: () => void;
  submit: (category: UserCategory) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const save = async () => {
    const normalizedName = name.trim();
    setFormError("");
    if (!normalizedName) {
      setFormError("Informe o nome da categoria.");
      return;
    }
    if (
      existingNames.some(
        (current) =>
          current.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
      )
    ) {
      setFormError("Já existe uma categoria com este nome.");
      return;
    }
    setSaving(true);
    try {
      await submit({
        id: crypto.randomUUID(),
        name: normalizedName,
        emoji: icon.trim() || "🏷️",
      });
    } catch {
      setFormError("Não foi possível salvar a categoria no Firestore.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal category-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span>CATEGORIA PESSOAL</span>
            <h2>Nova categoria</h2>
          </div>
          <button onClick={close} aria-label="Fechar">
            <X />
          </button>
        </div>
        <label>
          Nome
          <input
            autoFocus
            value={name}
            maxLength={80}
            placeholder="Ex.: Pets"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="icon-picker-head">
          <div>
            <b>Escolha um ícone</b>
            <small>Biblioteca de ícones financeiros e pessoais</small>
          </div>
          <span className="selected-icon-preview">
            <CategoryIcon icon={icon} />
          </span>
        </div>
        <div
          className="icon-library"
          role="list"
          aria-label="Ícones disponíveis"
        >
          {categoryIconLibrary.map((libraryIcon) => (
            <button
              type="button"
              className={icon === libraryIcon ? "selected" : ""}
              onClick={() => setIcon(libraryIcon)}
              aria-label={`Usar ícone ${libraryIcon}`}
              key={libraryIcon}
            >
              {libraryIcon}
            </button>
          ))}
        </div>
        <label className="custom-icon-upload">
          <Upload />
          <div>
            <b>Enviar ícone personalizado</b>
            <small>PNG, JPG ou WebP de até 2 MB</small>
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFormError("");
              try {
                setIcon(await resizeCategoryImage(file));
              } catch (cause) {
                setFormError(
                  cause instanceof Error
                    ? cause.message
                    : "Não foi possível processar a imagem.",
                );
              }
              event.target.value = "";
            }}
          />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <button className="submit" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Criar categoria"}
        </button>
      </div>
    </div>
  );
}

function CommonView({
  transactions,
  categories,
  search,
  setSearch,
  budget,
}: {
  transactions: Transaction[];
  categories: ReadonlyArray<readonly [string, string]>;
  search: string;
  setSearch: (s: string) => void;
  budget: number;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const expenses = transactions.filter(
      (transaction) =>
        transaction.kind === "expense" && transaction.pillar === "common",
    ),
    currentExpenses = expenses.filter(
      (transaction) => transaction.date <= localDate(),
    ),
    futureExpenses = expenses.filter(
      (transaction) => transaction.date > localDate(),
    ),
    total = currentExpenses.reduce(
      (sum, transaction) => sum + transaction.value,
      0,
    ),
    futureTotal = futureExpenses.reduce(
      (sum, transaction) => sum + transaction.value,
      0,
    ),
    daily = Math.max(
      0,
      (budget - total) / Math.max(1, 31 - new Date().getDate()),
    );
  const pie = categories
    .map(([name]) => ({
      name,
      value: currentExpenses
        .filter((t) => t.category === name)
        .reduce((s, t) => s + t.value, 0),
    }))
    .filter((x) => x.value);
  const filtered = expenses.filter((t) =>
    (t.description + t.category).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="page">
      <div className="metric-row">
        <Metric label="ORÇAMENTO DO MÊS" value={money.format(budget)} />
        <Metric label="GASTO ATÉ AGORA" value={money.format(total)} />
        <Metric label="SAÍDAS FUTURAS" value={money.format(futureTotal)} />
        <Metric label="LIMITE DIÁRIO SUGERIDO" value={money.format(daily)} />
      </div>
      <div className="content-grid">
        <article className="panel chart">
          <span>DISTRIBUIÇÃO</span>
          <h2>Gastos por categoria</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pie} innerRadius={68} outerRadius={98} dataKey="value">
                {pie.map((item, i) => (
                  <Cell
                    className="category-slice"
                    key={item.name}
                    fill={colors[i % colors.length]}
                    onClick={() => setSelectedCategory(item.name)}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money.format(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">
            {pie.map((p, i) => (
              <button key={p.name} onClick={() => setSelectedCategory(p.name)}>
                <i style={{ background: colors[i] }} />
                {p.name}
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <span>EXTRATO</span>
          <h2>Saídas do pilar</h2>
          <label className="search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lançamento ou categoria"
            />
          </label>
          <TransactionList transactions={filtered} />
        </article>
      </div>
      {selectedCategory && (
        <CategoryDetailsModal
          category={selectedCategory}
          budget={budget}
          expenses={expenses.filter(
            (transaction) => transaction.category === selectedCategory,
          )}
          close={() => setSelectedCategory(null)}
        />
      )}
    </section>
  );
}

function CategoryDetailsModal({
  category,
  budget,
  expenses,
  close,
}: {
  category: string;
  budget: number;
  expenses: Transaction[];
  close: () => void;
}) {
  const currentExpenses = expenses.filter(
    (transaction) => transaction.date <= localDate(),
  );
  const scheduledExpenses = expenses.filter(
    (transaction) => transaction.date > localDate(),
  );
  const spent = currentExpenses.reduce(
    (total, transaction) => total + transaction.value,
    0,
  );
  const scheduled = scheduledExpenses.reduce(
    (total, transaction) => total + transaction.value,
    0,
  );
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal category-details" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span>DETALHES DA CATEGORIA</span>
            <h2>{category}</h2>
          </div>
          <button onClick={close} aria-label="Fechar">
            <X />
          </button>
        </div>
        <div className="category-budget-summary">
          <div>
            <small>Total gasto</small>
            <strong>{money.format(spent)}</strong>
          </div>
          <div>
            <small>Do orçamento</small>
            <strong>{percentage.toFixed(1).replace(".", ",")}%</strong>
          </div>
          <div>
            <small>Agendado</small>
            <strong>{money.format(scheduled)}</strong>
          </div>
        </div>
        <div className="category-budget-progress">
          <i style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>
        <p className="category-budget-caption">
          Esta categoria consumiu {percentage.toFixed(1).replace(".", ",")}% do
          orçamento total de {money.format(budget)}.
        </p>
        <div className="category-expense-list">
          <div className="category-list-title">
            <span>SAÍDAS CONFIRMADAS</span>
            <b>{currentExpenses.length}</b>
          </div>
          <TransactionList transactions={currentExpenses} />
          {scheduledExpenses.length > 0 && (
            <>
              <div className="category-list-title scheduled">
                <span>SAÍDAS AGENDADAS</span>
                <b>{scheduledExpenses.length}</b>
              </div>
              <TransactionList transactions={scheduledExpenses} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function ReserveView({
  goals,
  transactions,
  balance,
  projectedBalance,
  onSave,
  onDelete,
  syncError,
}: {
  goals: Goal[];
  transactions: Transaction[];
  balance: number;
  projectedBalance: number;
  onSave: (goal: Goal) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
  syncError: string;
}) {
  const [editing, setEditing] = useState<Goal | null | "new">(null);
  const withdrawnByGoal = transactions
    .filter(
      (transaction) =>
        transaction.kind === "expense" &&
        transaction.pillar === "reserve" &&
        transaction.reserveId &&
        transaction.date <= localDate(),
    )
    .reduce<Record<string, number>>((total, transaction) => {
      total[transaction.reserveId!] =
        (total[transaction.reserveId!] ?? 0) + transaction.value;
      return total;
    }, {});
  const goalsTotal = goals.reduce(
    (sum, goal) => sum + Math.max(0, goal.value - (withdrawnByGoal[goal.id] ?? 0)),
    0,
  );
  const target = goals.reduce((s, g) => s + g.target, 0);
  const projection = Array.from({ length: 13 }, (_, i) => ({
    month: i,
    value: new Decimal(Math.max(0, balance))
      .times(new Decimal(1.009).pow(i))
      .toNumber(),
  }));
  return (
    <section className="page">
      <div className="metric-row">
        <Metric label="SALDO ATUAL" value={money.format(balance)} />
        <Metric
          label="APÓS GASTOS AGENDADOS"
          value={money.format(projectedBalance)}
        />
        <Metric label="TOTAL NOS OBJETIVOS" value={money.format(goalsTotal)} />
        <Metric
          label="PROGRESSO"
          value={`${target > 0 ? Math.round((goalsTotal / target) * 100) : 0}%`}
        />
      </div>
      <div className="section-actions">
        <div>
          <span>COFRINHOS E OBJETIVOS</span>
          <h2>Minhas reservas</h2>
        </div>
        <button className="primary" onClick={() => setEditing("new")}>
          <Plus /> Nova reserva
        </button>
      </div>
      {syncError && <p className="sync-error">{syncError}</p>}
      <div className="goal-grid">
        {goals.length === 0 && (
          <article className="panel empty-state">
            <Target />
            <h2>Nenhum objetivo criado</h2>
            <p>Configure sua primeira reserva ou objetivo financeiro.</p>
            <button className="primary" onClick={() => setEditing("new")}>
              <Plus /> Criar reserva
            </button>
          </article>
        )}
        {goals.map((g) => (
          <article className="goal" key={g.id}>
            <div>
              <Target />
              <b>{g.name}</b>
              <span>{g.cdi}% do CDI</span>
            </div>
            <strong>
              {money.format(Math.max(0, g.value - (withdrawnByGoal[g.id] ?? 0)))}{" "}
              <small>de {money.format(g.target)}</small>
            </strong>
            {(withdrawnByGoal[g.id] ?? 0) > 0 && (
              <small className="negative">
                {money.format(withdrawnByGoal[g.id])} retirados
              </small>
            )}
            <div className="progress">
              <i
                style={{
                  width: `${Math.min(g.target > 0 ? (Math.max(0, g.value - (withdrawnByGoal[g.id] ?? 0)) / g.target) * 100 : 0, 100)}%`,
                }}
              />
            </div>
            <div className="goal-actions">
              <button onClick={() => setEditing(g)}>Editar</button>
              <button
                className="danger-link"
                onClick={async () => {
                  if (!confirm(`Excluir a reserva "${g.name}"?`)) return;
                  try {
                    await onDelete(g.id);
                  } catch {
                    alert("Não foi possível excluir a reserva no Firestore.");
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
      <article className="panel chart-wide">
        <span>SIMULAÇÃO</span>
        <h2>Projeção da reserva — 12 meses</h2>
        <p>Projeção calculada sobre o saldo atual da Reserva.</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={projection}>
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7c6cf2" stopOpacity=".45" />
                <stop offset="1" stopColor="#7c6cf2" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ffffff12" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis hide />
            <Tooltip formatter={(v) => money.format(Number(v))} />
            <Area
              dataKey="value"
              stroke="#988cff"
              fill="url(#area)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </article>
      {editing && (
        <ReserveModal
          goal={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
          submit={async (goal) => {
            await onSave(goal);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function ReserveModal({
  goal,
  close,
  submit,
}: {
  goal?: Goal;
  close: () => void;
  submit: (goal: Goal) => Promise<void>;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [value, setValue] = useState(
    goal
      ? goal.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "",
  );
  const [target, setTarget] = useState(
    goal
      ? goal.target.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "",
  );
  const [cdi, setCdi] = useState(String(goal?.cdi ?? 100));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const parseMoney = (input: string) =>
    Number(input.replace(/\./g, "").replace(",", ".")) || 0;
  const saveReserve = async () => {
    setFormError("");
    const parsedValue = parseMoney(value);
    const parsedTarget = parseMoney(target);
    const parsedCdi = Number(cdi.replace(",", "."));
    if (!name.trim()) {
      setFormError("Informe o nome da reserva.");
      return;
    }
    if (parsedValue < 0 || parsedTarget <= 0 || parsedCdi <= 0) {
      setFormError("Informe meta e CDI maiores que zero.");
      return;
    }
    setSaving(true);
    try {
      await submit({
        id: goal?.id ?? crypto.randomUUID(),
        name: name.trim(),
        value: parsedValue,
        target: parsedTarget,
        cdi: parsedCdi,
      });
    } catch {
      setFormError(
        "Não foi possível salvar no Firestore. Desative bloqueadores para este site e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <span>RESERVA FINANCEIRA</span>
            <h2>{goal ? "Editar reserva" : "Nova reserva"}</h2>
          </div>
          <button onClick={close} aria-label="Fechar">
            <X />
          </button>
        </div>
        <label>
          Nome da reserva
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Reserva de emergência"
          />
        </label>
        <div className="form-grid">
          <label>
            Saldo atual (R$)
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            Meta (R$)
            <input
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="10.000,00"
            />
          </label>
        </div>
        <label>
          Rentabilidade (% do CDI)
          <input
            inputMode="decimal"
            value={cdi}
            onChange={(event) => setCdi(event.target.value)}
            placeholder="100"
          />
          <small className="field-hint">
            Exemplos: 100% do CDI, 105% do CDI ou 110% do CDI.
          </small>
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <button className="submit" onClick={saveReserve} disabled={saving}>
          {saving
            ? "Salvando..."
            : goal
              ? "Salvar alterações"
              : "Criar reserva"}
        </button>
      </div>
    </div>
  );
}
function InvestmentsView({ freeCash }: { freeCash: number }) {
  const invested = seedAssets.reduce(
      (s, a) => s + a.averagePrice * a.quantity,
      0,
    ),
    current = seedAssets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  return (
    <section className="page">
      <div className="metric-row">
        <Metric label="TOTAL INVESTIDO" value={money.format(invested)} />
        <Metric label="VALOR ATUAL" value={money.format(current)} />
        <Metric
          label="CAIXA LIVRE PARA APORTAR"
          value={money.format(freeCash)}
        />
      </div>
      <article className="panel table-panel">
        <div className="panel-head">
          <div>
            <span>POSIÇÕES</span>
            <h2>Carteira de ativos</h2>
          </div>
          <button className="primary">
            <Plus /> Novo ativo
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Tipo</th>
                <th>Qtd.</th>
                <th>Preço médio</th>
                <th>Investido</th>
                <th>Valor atual</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {seedAssets.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Nenhum ativo cadastrado.
                  </td>
                </tr>
              )}
              {seedAssets.map((a) => {
                const result = (a.currentPrice - a.averagePrice) * a.quantity;
                return (
                  <tr key={a.id}>
                    <td>
                      <b>{a.ticker}</b>
                    </td>
                    <td>{a.type}</td>
                    <td>{a.quantity}</td>
                    <td>{money.format(a.averagePrice)}</td>
                    <td>{money.format(a.averagePrice * a.quantity)}</td>
                    <td>{money.format(a.currentPrice * a.quantity)}</td>
                    <td className={result >= 0 ? "positive" : "negative"}>
                      {result >= 0 ? "+" : ""}
                      {money.format(result)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
function SettingsView({
  transactions,
  setTransactions,
}: {
  transactions: Transaction[];
  setTransactions: (v: Transaction[]) => void | Promise<void>;
}) {
  const [accountPassword, setAccountPasswordValue] = useState("");
  const [confirmAccountPassword, setConfirmAccountPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const saveAccountPassword = async () => {
    setPasswordMessage("");
    setPasswordError("");
    if (accountPassword.length < 6) {
      setPasswordError("A senha deve possuir pelo menos 6 caracteres.");
      return;
    }
    if (accountPassword !== confirmAccountPassword) {
      setPasswordError("As senhas não são iguais.");
      return;
    }
    try {
      await setAccountPassword(accountPassword);
      setPasswordMessage("Senha definida. O login por e-mail já está ativo.");
      setAccountPasswordValue("");
      setConfirmAccountPassword("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setPasswordError(
        message.includes("requires-recent-login")
          ? "Saia e entre novamente com Google antes de definir a senha."
          : "Não foi possível definir a senha da conta.",
      );
    }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "controle-financeiro.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data)) void setTransactions(data);
      } catch {
        alert("Arquivo JSON inválido");
      }
    };
    reader.readAsText(file);
  };
  return (
    <section className="page">
      <div className="settings-grid">
        <article className="panel">
          <div className="setting-icon">
            <Upload />
          </div>
          <h2>Importar dados</h2>
          <p>Restaure um backup JSON exportado pelo sistema.</p>
          <label className="primary file">
            Selecionar JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => importData(e.target.files?.[0])}
            />
          </label>
        </article>
        <article className="panel">
          <div className="setting-icon">
            <Download />
          </div>
          <h2>Exportar backup</h2>
          <p>Baixe todos os lançamentos em um arquivo portátil.</p>
          <button className="primary" onClick={exportData}>
            Baixar JSON
          </button>
        </article>
        <article className="panel">
          <div className="setting-icon">
            <Landmark />
          </div>
          <h2>Firebase</h2>
          <p>
            Configure as credenciais em <code>.env.local</code> para ativar
            login e sincronização em nuvem.
          </p>
          <span className="status">Sincronização ativa</span>
        </article>
        <article className="panel password-card">
          <div className="setting-icon">
            <Shield />
          </div>
          <h2>Senha da conta</h2>
          <p>
            Vincule uma senha ao e-mail autenticado para entrar sem o Google.
          </p>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nova senha"
            value={accountPassword}
            onChange={(event) => setAccountPasswordValue(event.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirmar nova senha"
            value={confirmAccountPassword}
            onChange={(event) => setConfirmAccountPassword(event.target.value)}
          />
          <button className="primary" onClick={saveAccountPassword}>
            Definir senha
          </button>
          {passwordMessage && (
            <small className="success-text">{passwordMessage}</small>
          )}
          {passwordError && (
            <small className="error-text">{passwordError}</small>
          )}
        </article>
      </div>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="transactions">
      {transactions.length === 0 && (
        <p className="empty">Nenhum lançamento encontrado.</p>
      )}
      {transactions.map((t) => (
        <div
          className={`transaction ${t.kind === "expense" && t.date > localDate() ? "future" : ""}`}
          key={t.id}
        >
          <span className={t.kind}>
            <span>{t.kind === "income" ? "↙" : "↗"}</span>
          </span>
          <div>
            <b>{t.description}</b>
            <small>
              {t.category} ·{" "}
              {t.reserveName && <>Reserva: {t.reserveName} · </>}
              {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
              {t.kind === "expense" && t.date > localDate() && (
                <span className="future-badge">Agendada</span>
              )}
            </small>
          </div>
          <strong className={t.kind === "income" ? "positive" : ""}>
            {t.kind === "income" ? "+" : "−"} {money.format(t.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}
function TransactionModal({
  kind,
  categories,
  goals,
  close,
  submit,
}: {
  kind: EntryKind;
  categories: ReadonlyArray<readonly [string, string]>;
  goals: Goal[];
  close: () => void;
  submit: (v: Omit<Transaction, "id">) => Promise<void>;
}) {
  const [value, setValue] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState("Mercado"),
    [pillar, setPillar] = useState<Pillar>("common"),
    [reserveId, setReserveId] = useState(""),
    [date, setDate] = useState(localDate());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const numeric = Number(value.replace(/\./g, "").replace(",", ".")) || 0;
  const confirm = async () => {
    setFormError("");
    if (numeric <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    if (kind === "expense" && pillar === "reserve" && !reserveId) {
      setFormError("Escolha o cofrinho ou objetivo de onde o valor será retirado.");
      return;
    }
    const selectedReserve = goals.find((goal) => goal.id === reserveId);
    setSaving(true);
    try {
      await submit({
        kind,
        value: numeric,
        description:
          description || (kind === "income" ? "Nova entrada" : category),
        category: kind === "income" ? "Renda" : category,
        pillar,
        date: kind === "expense" ? date : localDate(),
        ...(kind === "expense" && pillar === "reserve" && selectedReserve
          ? { reserveId: selectedReserve.id, reserveName: selectedReserve.name }
          : {}),
      });
      close();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar no Firestore. Verifique sua conexão.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <span>NOVO LANÇAMENTO</span>
            <h2>
              {kind === "income" ? "Registrar entrada" : "Registrar saída"}
            </h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <label>
          Valor (R$)
          <input
            className="money-input"
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label>
          Descrição
          <input
            placeholder={
              kind === "income" ? "Ex.: Salário mensal" : "Observação opcional"
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {kind === "expense" && (
          <>
            <label>
              Data da saída
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <small className="field-help">
                Escolha uma data futura para agendar sem descontar do saldo
                agora.
              </small>
            </label>
            <label>
              Origem
              <select
                value={pillar}
                onChange={(e) => setPillar(e.target.value as Pillar)}
              >
                <option value="common">Uso comum</option>
                <option value="reserve">Reserva</option>
                <option value="investments">Investimentos</option>
              </select>
            </label>
            {pillar === "reserve" && (
              <label>
                Cofrinho ou objetivo
                <select
                  value={reserveId}
                  onChange={(event) => setReserveId(event.target.value)}
                  required
                >
                  <option value="">Selecione a reserva</option>
                  {goals.map((goal) => (
                    <option value={goal.id} key={goal.id}>
                      {goal.name} — {money.format(goal.value)}
                    </option>
                  ))}
                </select>
                {goals.length === 0 && (
                  <small className="field-help">
                    Crie primeiro um cofrinho na página de Reservas.
                  </small>
                )}
              </label>
            )}
            <div className="category-grid">
              {categories.map(([name, emoji]) => (
                <button
                  className={category === name ? "selected" : ""}
                  onClick={() => setCategory(name)}
                  key={name}
                >
                  <span>
                    <CategoryIcon icon={emoji} />
                  </span>
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
        {kind === "income" && numeric > 0 && (
          <div className="split">
            <p>DESTINO INICIAL</p>
            <div>
              <span>
                Uso comum <b>{money.format(numeric)}</b>
              </span>
            </div>
            <small>
              Depois, use “Mover dinheiro” para transferir valores entre Uso
              comum e Reserva.
            </small>
          </div>
        )}
        {formError && <p className="form-error">{formError}</p>}
        <button className="submit" onClick={confirm} disabled={saving}>
          {saving ? "Salvando..." : "Confirmar lançamento"}
        </button>
      </div>
    </div>
  );
}

function DistributionModal({
  current,
  commonBalance,
  reserveBalance,
  close,
  submit,
}: {
  current: Distribution;
  commonBalance: number;
  reserveBalance: number;
  close: () => void;
  submit: (value: Distribution) => Promise<void>;
}) {
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const parseMoney = (value: string) =>
    Number(value.replace(/\./g, "").replace(",", ".")) || 0;
  const transferValue = parseMoney(amount);
  const available = direction === "deposit" ? commonBalance : current.reserve;
  const nextCommon = new Decimal(commonBalance)
    .plus(direction === "withdraw" ? transferValue : -transferValue)
    .toNumber();
  const nextReserve = new Decimal(reserveBalance)
    .plus(direction === "deposit" ? transferValue : -transferValue)
    .toNumber();

  const confirm = async () => {
    setFormError("");
    if (transferValue <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    if (new Decimal(transferValue).greaterThan(Math.max(0, available))) {
      setFormError(
        `Saldo insuficiente. Disponível: ${money.format(Math.max(0, available))}.`,
      );
      return;
    }
    setSaving(true);
    try {
      const reserve = new Decimal(current.reserve)
        .plus(direction === "deposit" ? transferValue : -transferValue)
        .toNumber();
      await submit({ reserve, investments: current.investments });
      close();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a transferência no Firestore.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <span>TRANSFERÊNCIA ENTRE SETORES</span>
            <h2>Mover dinheiro</h2>
          </div>
          <button onClick={close} aria-label="Fechar">
            <X />
          </button>
        </div>
        <p className="modal-description">
          Transfira sem alterar o saldo total da sua conta.
        </p>
        <label>
          Operação
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "deposit" | "withdraw")
            }
          >
            <option value="deposit">Uso comum → Reserva</option>
            <option value="withdraw">Reserva → Uso comum</option>
          </select>
        </label>
        <label>
          Valor (R$)
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <div className="distribution-summary">
          <div>
            <span>Disponível na origem</span>
            <b>{money.format(Math.max(0, available))}</b>
          </div>
          <div className="remaining">
            <span>Uso comum após transferência</span>
            <b>{money.format(nextCommon)}</b>
          </div>
          <div className="remaining">
            <span>Reserva após transferência</span>
            <b>{money.format(nextReserve)}</b>
          </div>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button className="submit" onClick={confirm} disabled={saving}>
          {saving ? "Transferindo..." : "Confirmar transferência"}
        </button>
      </div>
    </div>
  );
}
