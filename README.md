# Meu Controle Financeiro

PWA responsivo para controle de finanças pessoais com distribuição manual da renda.

## Recursos implementados

- dashboard consolidado e distribuição em reais com precisão via `decimal.js`;
- entradas e saídas rápidas, categorias e origem do saldo;
- visão de uso comum com limite diário, busca e gráfico por categoria;
- reserva, objetivos e projeção de rendimento composto;
- carteira de investimentos e caixa livre para aportar;
- backup e restauração em JSON;
- persistência local, funcionamento offline e instalação como PWA;
- configuração Firebase e regras Firestore isoladas por usuário.

## Executar no Windows

```powershell
npm.cmd install
npm.cmd run dev
```

Build de produção:

```powershell
npm.cmd run build
```

## Firebase

1. No projeto `m0abl1financas`, habilite Authentication com o provedor Google e crie o Firestore.
2. Copie `.env.example` para `.env.local` e preencha as variáveis `VITE_FIREBASE_*`.
3. Instale a CLI e autentique: `npm.cmd install -g firebase-tools` e `firebase.cmd login`.
4. O projeto já está associado pelo arquivo `.firebaserc`.
5. Gere o build e publique: `npm.cmd run build` e `firebase.cmd deploy`.

### Contas de usuário

Cada cadastro por e-mail/senha ou primeiro acesso pelo Google cria automaticamente um perfil:

- coleção: `usuarios`;
- documento: UID da conta autenticada;
- campo: `cargo` (string) com valor `usuario`.

Contas antigas com cargo `dono` continuam compatíveis. Os lançamentos, reservas e configurações ficam em `dados/{uid}` e não são compartilhados entre usuários.

Nunca versione `.env.local`. As chaves públicas do cliente Firebase não substituem as regras de autorização; `firestore.rules` restringe cada usuário ao próprio caminho `dados/{uid}`.

Para autenticação por redirecionamento em navegadores móveis, use `m0abl1financas.web.app` como `VITE_FIREBASE_AUTH_DOMAIN`. Isso mantém o fluxo OAuth no mesmo domínio do PWA e evita perda de sessão por bloqueio de armazenamento entre sites.
