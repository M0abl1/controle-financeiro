import {
  cloneElement,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Chrome,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  auth,
  createAccount,
  db,
  emailLogin,
  firebaseEnabled,
  googleLogin,
  logout,
  resetPassword,
} from "./firebase";

type Status =
  | "loading"
  | "signedOut"
  | "checking"
  | "authorized"
  | "denied"
  | "configError";

type AppAuthProps = { currentUser?: User; onLogout?: () => Promise<void> };

export function AuthGate({
  children,
}: {
  children: ReactElement<AppAuthProps>;
}) {
  const [status, setStatus] = useState<Status>(
    firebaseEnabled ? "loading" : "configError",
  );
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("moablima2016@gmail.com");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formMode, setFormMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const verifyOwner = async (currentUser: User) => {
    if (!db) return;
    setUser(currentUser);
    setStatus("checking");
    try {
      const profileRef = doc(db, "usuarios", currentUser.uid);
      let profile = await getDoc(profileRef);
      if (!profile.exists()) {
        await setDoc(profileRef, {
          email: currentUser.email,
          cargo: "pendente",
          criadoEm: serverTimestamp(),
        });
        profile = await getDoc(profileRef);
      }
      if (profile.exists() && profile.data().cargo === "dono") {
        setStatus("authorized");
      } else {
        setStatus("denied");
      }
    } catch {
      setError("Não foi possível validar sua autorização no Firestore.");
      setStatus("denied");
    }
  };

  useEffect(() => {
    if (!auth || !db) return;
    let authResolved = false;
    const loadingTimeout = window.setTimeout(() => {
      if (authResolved) return;
      setError("A sessão demorou para responder. Entre novamente.");
      setStatus("signedOut");
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      authResolved = true;
      window.clearTimeout(loadingTimeout);
      if (!currentUser) {
        setUser(null);
        setStatus("signedOut");
        return;
      }
      await verifyOwner(currentUser);
    });

    return () => {
      window.clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, []);

  const handleEmailLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setNotice("");
    setStatus("checking");
    try {
      const credential = await emailLogin(email.trim(), password);
      await verifyOwner(credential.user);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(
        code.includes("invalid-credential")
          ? "E-mail ou senha inválidos. Use ‘Definir ou recuperar senha’ se necessário."
          : "Não foi possível entrar com e-mail e senha.",
      );
      setStatus("signedOut");
    }
  };

  const handleCreateAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim() || password.length < 6) {
      setError("A senha deve possuir pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas informadas não são iguais.");
      return;
    }
    setStatus("checking");
    try {
      const credential = await createAccount(email.trim(), password);
      await verifyOwner(credential.user);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message.includes("email-already-in-use")
          ? "Este e-mail já possui uma conta. Entre ou recupere a senha."
          : "Não foi possível criar a conta.",
      );
      setStatus("signedOut");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setNotice("");
    setStatus("checking");
    try {
      const credential = await googleLogin();
      await verifyOwner(credential.user);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Falha ao entrar com Google.";
      if (!message.includes("popup-closed-by-user")) setError(message);
      setStatus("signedOut");
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("Informe seu e-mail primeiro.");
      return;
    }
    setError("");
    try {
      await resetPassword(email.trim());
      setNotice("Enviamos um link para definir ou recuperar sua senha.");
    } catch {
      setError("Não foi possível enviar o e-mail de recuperação.");
    }
  };

  if (status === "authorized" && user) {
    return cloneElement(children, { currentUser: user, onLogout: logout });
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-logo">
          <WalletCards />
        </div>
        <span>FINANÇAS PESSOAIS</span>
        <h1>
          Seu dinheiro.
          <br />
          <em>Sob seu controle.</em>
        </h1>
        <p>
          Organize, acompanhe e distribua sua renda em valores definidos por
          você.
        </p>
        <div className="security-note">
          <ShieldCheck />
          <div>
            <b>Acesso privado e protegido</b>
            <small>
              Somente a conta com cargo dono no Firebase pode acessar os dados.
            </small>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-icon">
          {status === "denied" ? <LockKeyhole /> : <ShieldCheck />}
        </div>

        {status === "configError" ? (
          <>
            <span>CONFIGURAÇÃO NECESSÁRIA</span>
            <h2>Firebase não configurado</h2>
          </>
        ) : status === "denied" ? (
          <>
            <span>ACESSO NEGADO</span>
            <h2>Conta sem autorização</h2>
            <p>
              A conta <b>{user?.email}</b> não possui o cargo <code>dono</code>.
            </p>
            <p>
              O perfil foi criado no Firestore com cargo <code>pendente</code>.
              Altere-o manualmente para <code>dono</code>.
            </p>
            <div className="uid-box">
              <small>UID PARA CADASTRO NO FIRESTORE</small>
              <code>{user?.uid}</code>
            </div>
            <button className="google-button" onClick={logout}>
              Usar outra conta
            </button>
          </>
        ) : status === "loading" || status === "checking" ? (
          <>
            <LoaderCircle className="spin" />
            <h2>
              {status === "checking" ? "Verificando permissão" : "Carregando"}
            </h2>
            <p>Aguarde enquanto validamos seu acesso seguro.</p>
          </>
        ) : (
          <>
            <span>ÁREA RESTRITA</span>
            <h2>
              {formMode === "login" ? "Entrar na sua conta" : "Criar conta"}
            </h2>
            <p>
              {formMode === "login"
                ? "Use seu e-mail e senha ou continue com o Google."
                : "Cadastre um e-mail e uma senha segura no Firebase."}
            </p>

            <form
              className="email-login"
              onSubmit={
                formMode === "login" ? handleEmailLogin : handleCreateAccount
              }
            >
              <label>
                E-mail
                <div className="login-input">
                  <Mail />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </label>
              <label>
                Senha
                <div className="login-input">
                  <LockKeyhole />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>
              {formMode === "register" && (
                <label>
                  Confirmar senha
                  <div className="login-input">
                    <LockKeyhole />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                      minLength={6}
                    />
                  </div>
                </label>
              )}
              <button className="submit" type="submit">
                {formMode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>

            {formMode === "login" && (
              <>
                <button
                  className="reset-password"
                  onClick={handleResetPassword}
                >
                  Definir ou recuperar senha
                </button>
                <div className="login-divider">
                  <span>ou</span>
                </div>
                <button className="google-button" onClick={handleGoogleLogin}>
                  <Chrome /> Continuar com Google
                </button>
              </>
            )}
            <button
              className="switch-auth-mode"
              onClick={() => {
                setFormMode((current) =>
                  current === "login" ? "register" : "login",
                );
                setPassword("");
                setConfirmPassword("");
                setError("");
                setNotice("");
              }}
            >
              {formMode === "login"
                ? "Ainda não tenho conta"
                : "Já tenho uma conta"}
            </button>
          </>
        )}

        {notice && <p className="login-notice">{notice}</p>}
        {error && <p className="login-error">{error}</p>}
        <small className="login-foot">
          <LockKeyhole /> Autenticação protegida pelo Firebase
        </small>
      </section>
    </main>
  );
}
