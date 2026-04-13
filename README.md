# Julia — Companheira Virtual

Chat estilo WhatsApp com assistente virtual feminina, carinhosa e acolhedora.

## 🚀 Stack

- **Frontend**: Next.js 15+ / TypeScript / Tailwind CSS v4 / Zustand
- **Backend**: Next.js Route Handlers
- **Banco**: Supabase (Postgres + Auth)
- **IA**: OpenAI API (gpt-4o-mini)
- **Pagamento**: Mercado Pago
- **Deploy**: Vercel (recomendado)

---

## 📋 Setup

### 1. Instalar dependências

```bash
cd julia-app
npm install
```

### 2. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Habilite **Anonymous Auth**: 
   - Settings → Authentication → User Signups → habilitar "Allow anonymous sign-ins"
3. Execute o SQL em `supabase-schema.sql` no SQL Editor do Supabase
4. Copie as credenciais

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
OPENAI_API_KEY=sk-sua-chave-openai
MERCADOPAGO_ACCESS_TOKEN=TEST-seu-access-token
MERCADOPAGO_WEBHOOK_SECRET=seu-webhook-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ASSISTANT_NAME=Julia
ADMIN_PASSWORD=sua-senha-admin
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

- Chat: http://localhost:3000/chat
- Admin: http://localhost:3000/admin

---

## 🏗️ Estrutura do projeto

```
julia-app/
├── public/
│   └── placeholder-avatar.jpg    # Avatar da Julia (trocar)
├── src/
│   ├── app/
│   │   ├── page.tsx              # Redirect → /chat
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # CSS WhatsApp theme
│   │   ├── chat/
│   │   │   ├── layout.tsx        # SEO metadata
│   │   │   └── page.tsx          # Página do chat
│   │   ├── admin/
│   │   │   ├── layout.tsx        # Auth guard
│   │   │   └── page.tsx          # Painel admin
│   │   └── api/
│   │       ├── session/init/     # Init sessão anônima
│   │       ├── conversation/     # GET conversa
│   │       ├── message/          # POST mensagem
│   │       ├── payment/
│   │       │   ├── create/       # Criar cobrança MP
│   │       │   └── webhook/      # Webhook MP
│   │       └── admin/
│   │           ├── auth/         # Login admin
│   │           ├── conversations/
│   │           ├── messages/[id]/
│   │           ├── payments/
│   │           ├── settings/
│   │           ├── assets/
│   │           ├── force-unlock/
│   │           └── send-image/
│   ├── components/chat/
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── ChatInput.tsx
│   │   ├── EmojiPicker.tsx
│   │   ├── LockedOverlay.tsx
│   │   ├── ImageMessage.tsx
│   │   └── PaymentModal.tsx
│   ├── store/
│   │   └── chat-store.ts        # Zustand state
│   └── lib/
│       ├── supabase/
│       │   ├── server.ts         # Service role client
│       │   └── client.ts         # Anon client
│       ├── fingerprint.ts        # Browser fingerprint
│       ├── openai.ts             # OpenAI client
│       ├── prompts.ts            # System prompt builder
│       ├── conversation-logic.ts # Regras de negócio
│       └── mercadopago.ts        # Mercado Pago SDK
├── supabase-schema.sql           # SQL completo
├── .env.example                  # Template de envs
└── package.json
```

---

## 💬 Regras do produto

| Fase | Respostas | Custo |
|------|-----------|-------|
| Gratuita | 15 respostas da Julia | Grátis |
| 1º pagamento | +30 respostas + 2 imagens | R$ 19,90 |
| N-ésimo pagamento | +30 respostas + 2 imagens | R$ 19,90 |

### Anti-burla
- Fingerprint do browser
- Auth anônima Supabase
- Todos os limites validados no backend
- Recarregar/fechar não reseta

---

## 📷 Trocar imagens da assistente

### Via painel admin (`/admin`)
1. Aba "Imagens"
2. Alterar URL do avatar
3. Cadastrar até 2 imagens pagas

### Via arquivo
- Avatar: substituir `public/placeholder-avatar.jpg`

---

## 💰 Mercado Pago

### Configurar credenciais
1. Acesse https://www.mercadopago.com.br/developers
2. Crie uma aplicação
3. Copie o Access Token (TEST para sandbox)
4. Configure `MERCADOPAGO_ACCESS_TOKEN` no `.env.local`

### Webhook
- URL: `https://seu-dominio.com/api/payment/webhook`
- Eventos: `payment`
- Configure `MERCADOPAGO_WEBHOOK_SECRET`

---

## 🚀 Deploy (Vercel)

1. Push para GitHub
2. Importe no Vercel
3. Configure as variáveis de ambiente
4. Deploy automático

```bash
git init
git add .
git commit -m "Julia - Companheira Virtual v1.0"
git remote add origin https://github.com/alexjuniopereirabarbosa-eng/julia.git
git push -u origin main
```

---

## 🔒 Segurança

- RLS habilitado em todas as tabelas
- Service role key nunca exposta no frontend
- Sanitização de input
- Validação de webhook Mercado Pago
- Rate limiting recomendado via Vercel/Cloudflare

---

## 📝 Licença

Projeto privado — uso restrito.
