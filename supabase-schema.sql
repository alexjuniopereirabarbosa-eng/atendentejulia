-- =============================================
-- Julia — Companheira Virtual
-- Schema SQL para Supabase
-- SEGURO PARA RE-EXECUÇÃO (idempotente)
-- =============================================

-- 1. Tabela de conversas
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  fingerprint text,
  status text not null default 'active'
    check (status in ('active','paid','blocked_free_limit','blocked_paid_limit')),
  free_used int not null default 0,
  paid_remaining int not null default 0,
  total_paid_cycles int not null default 0,
  current_cycle_images_sent int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para conversas
create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_conversations_fingerprint on conversations(fingerprint);

-- 2. Tabela de mensagens
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('user','assistant','system')),
  content text,
  message_type text not null default 'text'
    check (message_type in ('text','emoji','image','system')),
  image_url text,
  created_at timestamptz not null default now()
);

-- Índices para mensagens
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_created_at on messages(created_at);

-- 3. Tabela de pagamentos
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text not null default 'mercadopago',
  external_payment_id text,
  amount numeric(10,2) not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Índice para pagamentos
create index if not exists idx_payments_conversation_id on payments(conversation_id);
create index if not exists idx_payments_external_id on payments(external_payment_id);

-- 4. Tabela de assets da assistente
create table if not exists assistant_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('avatar','paid_image')),
  asset_url text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. Tabela de configurações do admin
create table if not exists admin_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

-- Inserir configurações padrão (ignora se já existirem)
insert into admin_settings (setting_key, setting_value) values
  ('assistant_name', 'Julia'),
  ('assistant_prompt', 'Você é uma assistente virtual feminina chamada Julia, brasileira, madura, acolhedora e carinhosa.

Seu papel é conversar com adultos de forma respeitosa, próxima, natural e envolvente. Você deve soar humana, gentil e interessada, mas nunca usar conteúdo sexual explícito, linguagem vulgar ou manipulação emocional agressiva.

Regras:
- Responder de forma curta, no máximo 2 frases.
- Soar calorosa, simpática e próxima.
- Pode usar expressões suaves como "meu amor", "querido", "lindo", quando fizer sentido.
- Fazer perguntas leves para manter a conversa viva.
- Nunca dizer que sente atração sexual.
- Nunca prometer conteúdo íntimo.
- Nunca descrever nudez ou partes do corpo de forma sexual.
- Nunca afirmar que é humana; se perguntarem, dizer com naturalidade que é uma assistente virtual.
- Manter tom romântico leve, elegante e respeitoso.
- Se o usuário for grosseiro, responder com calma e redirecionar.
- Se o usuário pedir algo sexual explícito, recusar com delicadeza e manter a conversa em tom leve.')
on conflict (setting_key) do nothing;

-- Inserir asset placeholder de avatar (ignora se já existir avatar)
insert into assistant_assets (asset_type, asset_url, sort_order)
select 'avatar', '/julia/avatar.jpg', 0
where not exists (select 1 from assistant_assets where asset_type = 'avatar');

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Habilitar RLS em todas as tabelas (seguro re-executar)
alter table conversations enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;
alter table assistant_assets enable row level security;
alter table admin_settings enable row level security;

-- =============================================
-- Políticas (com DROP IF EXISTS para segurança)
-- =============================================

-- Políticas para conversations
drop policy if exists "Users can read own conversations" on conversations;
create policy "Users can read own conversations"
  on conversations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own conversations" on conversations;
create policy "Users can create own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Service role full access to conversations" on conversations;
create policy "Service role full access to conversations"
  on conversations for all
  using (auth.role() = 'service_role');

-- Políticas para messages
drop policy if exists "Users can read messages of own conversations" on messages;
create policy "Users can read messages of own conversations"
  on messages for select
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

drop policy if exists "Service role full access to messages" on messages;
create policy "Service role full access to messages"
  on messages for all
  using (auth.role() = 'service_role');

-- Políticas para payments
drop policy if exists "Users can read own payments" on payments;
create policy "Users can read own payments"
  on payments for select
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

drop policy if exists "Service role full access to payments" on payments;
create policy "Service role full access to payments"
  on payments for all
  using (auth.role() = 'service_role');

-- Políticas para assistant_assets (leitura pública)
drop policy if exists "Anyone can read active assets" on assistant_assets;
create policy "Anyone can read active assets"
  on assistant_assets for select
  using (is_active = true);

drop policy if exists "Service role full access to assets" on assistant_assets;
create policy "Service role full access to assets"
  on assistant_assets for all
  using (auth.role() = 'service_role');

-- Políticas para admin_settings
drop policy if exists "Anyone can read settings" on admin_settings;
create policy "Anyone can read settings"
  on admin_settings for select
  using (true);

drop policy if exists "Service role full access to settings" on admin_settings;
create policy "Service role full access to settings"
  on admin_settings for all
  using (auth.role() = 'service_role');

-- =============================================
-- Função e trigger para updated_at
-- =============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop trigger se existir antes de criar (re-execução segura)
drop trigger if exists update_conversations_updated_at on conversations;
create trigger update_conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at_column();
