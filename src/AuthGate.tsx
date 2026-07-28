import { cloneElement, useEffect, useState, type ReactElement } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { Chrome, LoaderCircle, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react'
import { auth, db, firebaseEnabled, googleLogin, logout } from './firebase'

type Status = 'loading' | 'signedOut' | 'checking' | 'authorized' | 'denied' | 'configError'

type AppAuthProps = { currentUser?: User; onLogout?: () => Promise<void> }

export function AuthGate({ children }: { children: ReactElement<AppAuthProps> }) {
  const [status, setStatus] = useState<Status>(firebaseEnabled ? 'loading' : 'configError')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth || !db) return
    return onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser)
      if (!currentUser) { setStatus('signedOut'); return }
      setStatus('checking')
      try {
        const profile = await getDoc(doc(db!, 'usuarios', currentUser.uid))
        if (profile.exists() && profile.data().cargo === 'dono') setStatus('authorized')
        else setStatus('denied')
      } catch {
        setError('Não foi possível validar sua autorização no Firestore.')
        setStatus('denied')
      }
    })
  }, [])

  const signIn = async () => {
    setError('')
    try { await googleLogin() }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha ao entrar com Google.'
      if (!message.includes('popup-closed-by-user')) setError(message)
    }
  }

  if (status === 'authorized' && user) {
    return cloneElement(children, { currentUser: user, onLogout: logout })
  }

  return <main className="login-page">
    <section className="login-brand">
      <div className="login-logo"><WalletCards /></div>
      <span>FINANÇAS PESSOAIS</span>
      <h1>Seu dinheiro.<br/><em>Sob seu controle.</em></h1>
      <p>Organize, acompanhe e faça seu patrimônio crescer com a estratégia 50/30/20.</p>
      <div className="security-note"><ShieldCheck/><div><b>Acesso privado e protegido</b><small>Somente a conta proprietária autorizada no Firebase pode acessar os dados.</small></div></div>
    </section>
    <section className="login-card">
      <div className="login-card-icon">{status === 'denied' ? <LockKeyhole/> : <ShieldCheck/>}</div>
      {status === 'configError' ? <><span>CONFIGURAÇÃO NECESSÁRIA</span><h2>Firebase não configurado</h2><p>Preencha as variáveis VITE_FIREBASE_* no arquivo <code>.env.local</code>.</p></> :
       status === 'denied' ? <><span>ACESSO NEGADO</span><h2>Conta sem autorização</h2><p>A conta <b>{user?.email}</b> não possui o cargo <code>dono</code> no Firebase.</p><button className="google-button" onClick={logout}>Usar outra conta</button></> :
       status === 'loading' || status === 'checking' ? <><LoaderCircle className="spin"/><h2>{status === 'checking' ? 'Verificando permissão' : 'Carregando'}</h2><p>Aguarde enquanto validamos seu acesso seguro.</p></> :
       <><span>ÁREA RESTRITA</span><h2>Bem-vindo de volta</h2><p>Entre com a conta Google autorizada como dona deste sistema.</p><button className="google-button" onClick={signIn}><Chrome/>Continuar com Google</button></>}
      {error && <p className="login-error">{error}</p>}
      <small className="login-foot"><LockKeyhole/> Autenticação protegida pelo Google Firebase</small>
    </section>
  </main>
}
