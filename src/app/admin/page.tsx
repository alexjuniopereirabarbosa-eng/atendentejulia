'use client';

import { useState, useEffect, useCallback } from 'react';

interface ConversationSummary {
  id: string;
  fingerprint: string;
  status: string;
  free_used: number;
  paid_remaining: number;
  total_paid_cycles: number;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface AdminSettings {
  assistant_name: string;
  assistant_prompt: string;
}

interface Asset {
  id: string;
  asset_type: string;
  asset_url: string;
  sort_order: number;
  is_active: boolean;
}

interface Payment {
  id: string;
  conversation_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

type Tab = 'conversations' | 'settings' | 'assets' | 'payments';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('conversations');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({ assistant_name: 'Julia', assistant_prompt: '' });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/conversations');
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
    setLoading(false);
  }, []);

  async function loadMessages(convId: string) {
    setSelectedConv(convId);
    const res = await fetch(`/api/admin/messages/${convId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  }

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
    }
    setLoading(false);
  }, []);

  async function saveSettings() {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    alert('Configurações salvas!');
  }

  const loadAssets = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/assets');
    if (res.ok) {
      const data = await res.json();
      setAssets(data.assets || []);
    }
    setLoading(false);
  }, []);

  async function saveAsset(assetType: string, url: string) {
    await fetch('/api/admin/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_type: assetType, asset_url: url }),
    });
    void loadAssets();
  }

  const loadPayments = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/payments');
    if (res.ok) {
      const data = await res.json();
      setPayments(data.payments || []);
    }
    setLoading(false);
  }, []);

  // Load data based on tab
  useEffect(() => {
    if (tab === 'conversations') void loadConversations();
    if (tab === 'settings') void loadSettings();
    if (tab === 'assets') void loadAssets();
    if (tab === 'payments') void loadPayments();
  }, [tab, loadConversations, loadSettings, loadAssets, loadPayments]);

  async function forceUnlock(convId: string) {
    if (!confirm('Tem certeza que deseja liberar essa conversa manualmente?')) return;
    await fetch('/api/admin/force-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId }),
    });
    void loadConversations();
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    paid: 'bg-blue-500/20 text-blue-400',
    blocked_free_limit: 'bg-yellow-500/20 text-yellow-400',
    blocked_paid_limit: 'bg-red-500/20 text-red-400',
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'conversations', label: 'Conversas', icon: '💬' },
    { key: 'payments', label: 'Pagamentos', icon: '💰' },
    { key: 'settings', label: 'Configurações', icon: '⚙️' },
    { key: 'assets', label: 'Imagens', icon: '📷' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedConv(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-[#00a884] text-white'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Conversations Tab */}
      {tab === 'conversations' && (
        <div>
          {!selectedConv ? (
            <div className="bg-[#202c33] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3b4a54] flex justify-between items-center">
                <h2 className="font-medium">Conversas ({conversations.length})</h2>
                <button onClick={loadConversations} className="text-[#00a884] text-sm hover:underline">
                  Atualizar
                </button>
              </div>
              {loading ? (
                <div className="p-8 text-center text-[#8696a0]">Carregando...</div>
              ) : (
                <div className="divide-y divide-[#3b4a54]">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="px-4 py-3 hover:bg-[#2a3942] cursor-pointer transition-colors flex items-center justify-between"
                      onClick={() => loadMessages(conv.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[conv.status] || 'bg-gray-500/20 text-gray-400'}`}>
                            {conv.status}
                          </span>
                          <span className="text-[#8696a0] text-xs truncate">
                            {conv.id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="text-[#8696a0] text-xs flex gap-3">
                          <span>Grátis: {conv.free_used}/15</span>
                          <span>Pagas: {conv.paid_remaining}</span>
                          <span>Ciclos: {conv.total_paid_cycles}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); forceUnlock(conv.id); }}
                          className="text-xs bg-[#00a884]/20 text-[#00a884] px-3 py-1 rounded-full hover:bg-[#00a884]/30"
                        >
                          Liberar
                        </button>
                        <span className="text-[#8696a0] text-xs">
                          {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="p-8 text-center text-[#8696a0]">Nenhuma conversa encontrada</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSelectedConv(null)}
                className="mb-4 text-[#00a884] text-sm hover:underline flex items-center gap-1"
              >
                ← Voltar
              </button>
              <div className="bg-[#202c33] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#3b4a54]">
                  <h2 className="font-medium">Mensagens — {selectedConv.slice(0, 8)}...</h2>
                </div>
                <div className="max-h-[600px] overflow-y-auto divide-y divide-[#3b4a54]/50">
                  {(messages as Array<{ id: string; sender: string; content: string; message_type: string; created_at: string }>).map((msg) => (
                    <div key={msg.id} className="px-4 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium ${
                          msg.sender === 'user' ? 'text-blue-400' : msg.sender === 'assistant' ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {msg.sender === 'user' ? '👤 Usuário' : msg.sender === 'assistant' ? '🤖 Julia' : '⚙️ Sistema'}
                        </span>
                        <span className="text-[#8696a0] text-xs">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-[#e9edef]">{msg.content || (msg.message_type === 'image' ? '📷 Imagem' : '—')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="bg-[#202c33] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3b4a54]">
            <h2 className="font-medium">Pagamentos ({payments.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[#8696a0]">Carregando...</div>
          ) : (
            <div className="divide-y divide-[#3b4a54]">
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {p.status}
                    </span>
                    <span className="text-[#8696a0] text-xs ml-2">{p.conversation_id.slice(0, 8)}...</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#e9edef] font-medium">R$ {p.amount.toFixed(2)}</span>
                    <div className="text-[#8696a0] text-xs">
                      {new Date(p.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="p-8 text-center text-[#8696a0]">Nenhum pagamento encontrado</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="bg-[#202c33] rounded-xl p-6 space-y-6">
          <div>
            <label className="block text-sm text-[#8696a0] mb-2">Nome da assistente</label>
            <input
              value={settings.assistant_name}
              onChange={(e) => setSettings({ ...settings, assistant_name: e.target.value })}
              className="w-full bg-[#2a3942] text-white px-4 py-2 rounded-lg border border-[#3b4a54] outline-none focus:border-[#00a884] text-sm"
              id="admin-assistant-name"
            />
          </div>
          <div>
            <label className="block text-sm text-[#8696a0] mb-2">Prompt base</label>
            <textarea
              value={settings.assistant_prompt}
              onChange={(e) => setSettings({ ...settings, assistant_prompt: e.target.value })}
              rows={12}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#3b4a54] outline-none focus:border-[#00a884] text-sm resize-y"
              id="admin-prompt"
            />
          </div>
          <button
            onClick={saveSettings}
            className="bg-[#00a884] hover:bg-[#008069] text-white px-6 py-2 rounded-lg transition-colors font-medium"
          >
            Salvar configurações
          </button>
        </div>
      )}

      {/* Assets Tab */}
      {tab === 'assets' && (
        <div className="space-y-4">
          <div className="bg-[#202c33] rounded-xl p-6">
            <h3 className="font-medium mb-4">Avatar da assistente</h3>
            <AssetEditor
              asset={assets.find((a) => a.asset_type === 'avatar')}
              onSave={(url) => saveAsset('avatar', url)}
            />
          </div>
          <div className="bg-[#202c33] rounded-xl p-6">
            <h3 className="font-medium mb-4">Imagens pagas (máximo 2)</h3>
            <div className="space-y-4">
              {[0, 1].map((i) => {
                const paidImages = assets.filter((a) => a.asset_type === 'paid_image');
                return (
                  <div key={i}>
                    <p className="text-[#8696a0] text-sm mb-2">Imagem {i + 1}</p>
                    <AssetEditor
                      asset={paidImages[i]}
                      onSave={(url) => saveAsset('paid_image', url)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetEditor({ asset, onSave }: { asset?: Asset; onSave: (url: string) => void }) {
  const assetUrl = asset?.asset_url || '';
  const [url, setUrl] = useState(assetUrl);
  const [prevAssetUrl, setPrevAssetUrl] = useState(assetUrl);
  if (assetUrl !== prevAssetUrl) {
    setPrevAssetUrl(assetUrl);
    setUrl(assetUrl);
  }

  return (
    <div className="flex gap-3 items-end">
      <div className="flex-1">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL da imagem"
          className="w-full bg-[#2a3942] text-white px-4 py-2 rounded-lg border border-[#3b4a54] outline-none focus:border-[#00a884] text-sm"
        />
      </div>
      <button
        onClick={() => onSave(url)}
        disabled={!url.trim()}
        className="bg-[#00a884] hover:bg-[#008069] text-white px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
      >
        Salvar
      </button>
      {url && (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#2a3942] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
