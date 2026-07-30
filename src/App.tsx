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
  Download,
  Home,
  Landmark,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import type { User } from "firebase/auth";
import { categories, seedAssets, seedGoals, seedTransactions } from "./data";
import { setAccountPassword } from "./firebase";
import { load } from "./storage";
import { listReserves, removeReserve, saveReserve } from "./reserveRepository";
import { listTransactions, saveTransaction } from "./transactionRepository";
import { getDistribution, saveDistribution } from "./distributionRepository";
import type {
  Distribution,
  EntryKind,
  Goal,
  Pillar,
  Transaction,
} from "./types";

type View = "home" | "common" | "reserve" | "investments" | "settings";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const colors = [
  "#8b5cf6",
  "#3b82f6",
  "#a78bfa",
  "#6366f1",
  "#60a5fa",
  "#c084fc",
  "#64748b",
];
const nav = [
  { id: "home", label: "Início", icon: Home },
  { id: "common", label: "Uso comum", icon: WalletCards },
  { id: "reserve", label: "Reserva", icon: Shield },
  { id: "investments", label: "Investimentos", icon: TrendingUp },
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
  const [reserveSyncError, setReserveSyncError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    let migratedLocalData = false;
    const refreshCloudData = async () => {
      try {
        let [cloudReserves, cloudTransactions, cloudDistribution] =
          await Promise.all([
            listReserves(currentUser.uid),
            listTransactions(currentUser.uid),
            getDistribution(currentUser.uid),
          ]);
        if (!migratedLocalData) {
          const localReserves = load<Goal[]>("cf-reserves-v2", []);
          const localTransactions = load<Transaction[]>(
            "cf-transactions-v1-clean",
            [],
          );
          const cloudReserveIds = new Set(cloudReserves.map((item) => item.id));
          const cloudTransactionIds = new Set(
            cloudTransactions.map((item) => item.id),
          );
          const missingReserves = localReserves.filter(
            (item) => !cloudReserveIds.has(item.id),
          );
          const missingTransactions = localTransactions.filter(
            (item) => !cloudTransactionIds.has(item.id),
          );
          await Promise.all([
            ...missingReserves.map((item) =>
              saveReserve(currentUser.uid, item),
            ),
            ...missingTransactions.map((item) =>
              saveTransaction(currentUser.uid, item),
            ),
          ]);
          cloudReserves = [...cloudReserves, ...missingReserves];
          cloudTransactions = [
            ...cloudTransactions,
            ...missingTransactions,
          ].sort((a, b) => b.date.localeCompare(a.date));
          migratedLocalData = true;
        }
        if (!active) return;
        setGoals(cloudReserves);
        setTransactions(cloudTransactions);
        setDistribution(cloudDistribution);
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
        .filter((transaction) => transaction.kind === "expense")
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
      allocated.reserve - expensesByPillar.reserve +
      goals.reduce((s, g) => s + g.value, 0),
    investments:
      allocated.investments - expensesByPillar.investments +
      seedAssets.reduce((s, a) => s + a.currentPrice * a.quantity, 0),
  };
  const total = balances.common + balances.reserve + balances.investments;
  const addTransaction = async (entry: Omit<Transaction, "id">) => {
    if (!currentUser) throw new Error("Usuário não autenticado");
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
    if (new Decimal(next.reserve).plus(next.investments).greaterThan(income)) {
      throw new Error("A distribuição supera a renda disponível");
    }
    await saveDistribution(currentUser.uid, next);
    setDistribution(next);
    setReserveSyncError("");
  };
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
          <span></span>Dados salvos neste dispositivo
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
              <b>{currentUser?.displayName || "Proprietário"}</b>
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
        {view === "home" && (
          <HomeView
            total={total}
            balances={balances}
            income={income}
            commonAllocated={allocated.common}
            commonExpense={expensesByPillar.common}
            transactions={transactions}
            setModal={setModal}
            onDistribute={() => setDistributionModal(true)}
          />
        )}
        {view === "common" && (
          <CommonView
            transactions={transactions}
            search={search}
            setSearch={setSearch}
            budget={allocated.common}
          />
        )}
        {view === "reserve" && (
          <ReserveView
            goals={goals}
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
          close={() => setModal(null)}
          submit={addTransaction}
        />
      )}
      {distributionModal && (
        <DistributionModal
          totalIncome={income}
          current={distribution}
          close={() => setDistributionModal(false)}
          submit={persistDistribution}
        />
      )}
    </div>
  );
}

function HomeView({
  total,
  balances,
  income,
  commonAllocated,
  commonExpense,
  transactions,
  setModal,
  onDistribute,
}: {
  total: number;
  balances: Record<Pillar, number>;
  income: number;
  commonAllocated: number;
  commonExpense: number;
  transactions: Transaction[];
  setModal: (v: EntryKind) => void;
  onDistribute: () => void;
}) {
  return (
    <section className="page">
      <article className="hero">
        <div>
          <span>PATRIMÔNIO TOTAL</span>
          <strong>{money.format(total)}</strong>
          <small>
            <TrendingUp size={14} /> visão consolidada dos três pilares
          </small>
        </div>
        <div className="hero-ring">
          <span>
            100<small>% livre</small>
          </span>
        </div>
      </article>
      <div className="pillar-grid">
        <PillarCard
          title="Uso comum"
          percent="Saldo"
          value={balances.common}
          icon={<WalletCards />}
          color="green"
          subtitle={`${money.format(commonExpense)} gastos no pilar`}
          progress={commonAllocated ? (commonExpense / commonAllocated) * 100 : 0}
        />
        <PillarCard
          title="Reserva"
          percent="Definido"
          value={balances.reserve}
          icon={<Shield />}
          color="purple"
          subtitle="Reserva + objetivos"
          progress={income ? (Math.max(0, balances.reserve) / income) * 100 : 0}
        />
        <PillarCard
          title="Investimentos"
          percent="Definido"
          value={balances.investments}
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
              <strong>Distribuir saldo</strong>
              <small>Defina valores em reais para cada setor</small>
            </div>
          </button>
          <button onClick={() => setModal("expense")}>
            <ArrowUpRight />
            <div>
              <strong>Registrar saída</strong>
              <small>Gasto, resgate ou retirada</small>
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
  icon,
  color,
  subtitle,
  progress,
}: {
  title: string;
  percent: string;
  value: number;
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
      <strong>{money.format(value)}</strong>
      <div className="progress">
        <i style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <p>{subtitle}</p>
    </article>
  );
}

function CommonView({
  transactions,
  search,
  setSearch,
  budget,
}: {
  transactions: Transaction[];
  search: string;
  setSearch: (s: string) => void;
  budget: number;
}) {
  const expenses = transactions.filter((t) => t.kind === "expense"),
    total = expenses.reduce((s, t) => s + t.value, 0),
    daily = Math.max(
      0,
      (budget - total) / Math.max(1, 31 - new Date().getDate()),
    );
  const pie = categories
    .map(([name]) => ({
      name,
      value: expenses
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
        <Metric label="LIMITE DIÁRIO SUGERIDO" value={money.format(daily)} />
      </div>
      <div className="content-grid">
        <article className="panel chart">
          <span>DISTRIBUIÇÃO</span>
          <h2>Gastos por categoria</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pie} innerRadius={68} outerRadius={98} dataKey="value">
                {pie.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money.format(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">
            {pie.map((p, i) => (
              <span key={p.name}>
                <i style={{ background: colors[i] }} />
                {p.name}
              </span>
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
    </section>
  );
}
function ReserveView({
  goals,
  onSave,
  onDelete,
  syncError,
}: {
  goals: Goal[];
  onSave: (goal: Goal) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
  syncError: string;
}) {
  const [editing, setEditing] = useState<Goal | null | "new">(null);
  const total = goals.reduce((s, g) => s + g.value, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const projection = Array.from({ length: 13 }, (_, i) => ({
    month: i,
    value: new Decimal(total).times(new Decimal(1.009).pow(i)).toNumber(),
  }));
  return (
    <section className="page">
      <div className="metric-row">
        <Metric label="TOTAL EM RESERVA" value={money.format(total)} />
        <Metric label="META TOTAL" value={money.format(target)} />
        <Metric
          label="PROGRESSO"
          value={`${target > 0 ? Math.round((total / target) * 100) : 0}%`}
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
              {money.format(g.value)} <small>de {money.format(g.target)}</small>
            </strong>
            <div className="progress">
              <i
                style={{
                  width: `${Math.min(g.target > 0 ? (g.value / g.target) * 100 : 0, 100)}%`,
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
          <span className="status">Configuração pendente</span>
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
        <div className="transaction" key={t.id}>
          <span className={t.kind}>
            <span>{t.kind === "income" ? "↙" : "↗"}</span>
          </span>
          <div>
            <b>{t.description}</b>
            <small>
              {t.category} ·{" "}
              {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
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
  close,
  submit,
}: {
  kind: EntryKind;
  close: () => void;
  submit: (v: Omit<Transaction, "id">) => Promise<void>;
}) {
  const [value, setValue] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState("Mercado"),
    [pillar, setPillar] = useState<Pillar>("common");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const numeric = Number(value.replace(/\./g, "").replace(",", ".")) || 0;
  const confirm = async () => {
    setFormError("");
    if (numeric <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await submit({
        kind,
        value: numeric,
        description:
          description || (kind === "income" ? "Nova entrada" : category),
        category: kind === "income" ? "Renda" : category,
        pillar,
        date: new Date().toISOString().slice(0, 10),
      });
      close();
    } catch {
      setFormError(
        "Não foi possível salvar no Firestore. Verifique sua conexão.",
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
            <div className="category-grid">
              {categories.map(([name, emoji]) => (
                <button
                  className={category === name ? "selected" : ""}
                  onClick={() => setCategory(name)}
                  key={name}
                >
                  <span>{emoji}</span>
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
              Depois, use “Distribuir saldo” para mover valores para Reserva e
              Investimentos.
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
  totalIncome,
  current,
  close,
  submit,
}: {
  totalIncome: number;
  current: Distribution;
  close: () => void;
  submit: (value: Distribution) => Promise<void>;
}) {
  const [reserve, setReserve] = useState(
    current.reserve ? String(current.reserve).replace(".", ",") : "",
  );
  const [investments, setInvestments] = useState(
    current.investments ? String(current.investments).replace(".", ",") : "",
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const parseMoney = (value: string) =>
    Number(value.replace(/\./g, "").replace(",", ".")) || 0;
  const reserveValue = parseMoney(reserve);
  const investmentsValue = parseMoney(investments);
  const distributed = new Decimal(reserveValue).plus(investmentsValue);
  const commonValue = new Decimal(totalIncome).minus(distributed).toNumber();

  const confirm = async () => {
    setFormError("");
    if (reserveValue < 0 || investmentsValue < 0) {
      setFormError("Os valores não podem ser negativos.");
      return;
    }
    if (distributed.greaterThan(totalIncome)) {
      setFormError("Reserva e investimentos superam a renda disponível.");
      return;
    }
    setSaving(true);
    try {
      await submit({ reserve: reserveValue, investments: investmentsValue });
      close();
    } catch {
      setFormError("Não foi possível salvar a distribuição no Firestore.");
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
            <span>DISTRIBUIÇÃO MANUAL</span>
            <h2>Distribuir saldo</h2>
          </div>
          <button onClick={close} aria-label="Fechar">
            <X />
          </button>
        </div>
        <p className="modal-description">
          Informe quanto da renda total deve ficar em cada setor.
        </p>
        <div className="form-grid">
          <label>
            Reserva (R$)
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={reserve}
              onChange={(event) => setReserve(event.target.value)}
            />
          </label>
          <label>
            Investimentos (R$)
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={investments}
              onChange={(event) => setInvestments(event.target.value)}
            />
          </label>
        </div>
        <div className="distribution-summary">
          <div>
            <span>Renda total</span>
            <b>{money.format(totalIncome)}</b>
          </div>
          <div className={commonValue < 0 ? "invalid" : "remaining"}>
            <span>Uso comum</span>
            <b>{money.format(commonValue)}</b>
          </div>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button className="submit" onClick={confirm} disabled={saving}>
          {saving ? "Salvando..." : "Salvar distribuição"}
        </button>
      </div>
    </div>
  );
}
