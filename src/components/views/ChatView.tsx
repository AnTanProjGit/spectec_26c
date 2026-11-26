import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Download,
  Upload,
  Phone,
  Bot,
  Sparkles,
  Search,
  RefreshCw,
  Copy,
  Check,
  CornerDownLeft,
  AlertCircle,
  Trash2
} from 'lucide-react';
import {
  ChatAttachment,
  ChatMessage,
  ClosingDocumentRecord,
  CRMDeal,
  DriverProfile,
  Equipment,
  FleetBranch,
  KnowledgeDoc,
  LegalDocument,
  LlmAdminSettings,
  RentalOrder,
  ShiftReport
} from '../../types';

export interface CustomerChatTarget {
  branchId: string;
  clientName: string;
  contactPerson: string;
  phone: string;
  dealId?: string;
  nonce: number;
}

interface ChatAgentSource {
  sourceType: string;
  title: string;
  detail: string;
}

interface ChatAgentTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  chatSummary?: string;
  suggestedReply?: string;
  matchedSources?: ChatAgentSource[];
  modelUsed?: string;
}

interface ChatViewProps {
  messages: ChatMessage[];
  deals: CRMDeal[];
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  orders?: RentalOrder[];
  equipmentList?: Equipment[];
  drivers?: DriverProfile[];
  shiftReports?: ShiftReport[];
  knowledgeDocs?: KnowledgeDoc[];
  legalDocuments?: LegalDocument[];
  closingDocs?: ClosingDocumentRecord[];
  llmConfig?: LlmAdminSettings;
  requestedChatTarget?: CustomerChatTarget | null;
  onSendMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
}

const ROLE_CONFIG: Record<
  ChatMessage['senderRole'],
  { label: string; badgeClass: string; defaultName: string }
> = {
  admin: {
    label: 'Админ',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    defaultName: 'Администратор системы'
  },
  fleet_manager: {
    label: 'Fleet Manager',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    defaultName: 'Диспетчер / Fleet Manager'
  },
  driver: {
    label: 'Машинист',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    defaultName: 'Машинист смены'
  },
  client: {
    label: 'Заказчик',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    defaultName: 'Представитель заказчика'
  }
};

const SOURCE_TYPE_META: Record<string, { label: string; badgeClass: string }> = {
  chat: {
    label: 'Чат',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  },
  knowledge: {
    label: 'База знаний',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  crm: {
    label: 'CRM',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
  },
  order: {
    label: 'Заказ',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  fleet: {
    label: 'Техника',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
  },
  driver: {
    label: 'Машинист',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  },
  legal: {
    label: 'Договор',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
  },
  closing_doc: {
    label: 'Акт / Счёт',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  }
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function nowTimeShort(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  deals,
  activeBranch,
  branches = [],
  orders = [],
  equipmentList = [],
  drivers = [],
  shiftReports = [],
  knowledgeDocs = [],
  legalDocuments = [],
  closingDocs = [],
  llmConfig,
  requestedChatTarget,
  onSendMessage
}) => {
  const defaultBranchId = activeBranch?.id || branches[0]?.id || 'branch-hq';

  const [selectedDealId, setSelectedDealId] = useState<string>('all');
  const [senderRole, setSenderRole] = useState<ChatMessage['senderRole']>('fleet_manager');
  const [messageText, setMessageText] = useState('');
  const [attachmentCategory, setAttachmentCategory] = useState<'requisites' | 'site_photo'>('requisites');
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [activeContactTarget, setActiveContactTarget] = useState<CustomerChatTarget | null>(null);

  // LLM Chat Agent State
  const [isAgentOpen, setIsAgentOpen] = useState(true);
  const [agentQuery, setAgentQuery] = useState('');
  const [agentTurns, setAgentTurns] = useState<ChatAgentTurn[]>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const agentEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!requestedChatTarget) return;
    setActiveContactTarget(requestedChatTarget);

    const matchingDeal =
      (requestedChatTarget.dealId &&
        deals.find(d => d.id === requestedChatTarget.dealId)) ||
      deals.find(
        d =>
          d.branchId === requestedChatTarget.branchId &&
          d.clientName === requestedChatTarget.clientName
      );

    if (matchingDeal) {
      setSelectedDealId(matchingDeal.id);
    } else {
      setSelectedDealId('all');
    }

    setSenderRole('fleet_manager');
    setMessageText(
      `${requestedChatTarget.contactPerson} (${requestedChatTarget.clientName}): `
    );

    setTimeout(() => {
      messageInputRef.current?.focus();
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  }, [requestedChatTarget, deals]);

  const filteredMessages = messages.filter((m) => {
    if (selectedDealId !== 'all') {
      return m.dealId === selectedDealId;
    }
    if (activeContactTarget) {
      const targetDealIds = new Set(
        deals
          .filter(
            d =>
              d.branchId === activeContactTarget.branchId &&
              d.clientName === activeContactTarget.clientName
          )
          .map(d => d.id)
      );
      const textLower = m.text.toLowerCase();
      const senderLower = m.senderName.toLowerCase();
      const clientLower = activeContactTarget.clientName.toLowerCase();
      const contactLower = activeContactTarget.contactPerson.toLowerCase();
      return (
        (m.dealId && targetDealIds.has(m.dealId)) ||
        senderLower.includes(clientLower) ||
        textLower.includes(clientLower) ||
        (contactLower.length > 3 && textLower.includes(contactLower))
      );
    }
    return true;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const detectedCategory: ChatAttachment['category'] = isImage ? 'site_photo' : attachmentCategory;

    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        id: `att-${Date.now()}`,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        category: detectedCategory,
        previewUrl: typeof reader.result === 'string' ? reader.result : undefined
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() && !pendingAttachment) return;

    const senderDisplayName =
      senderRole === 'fleet_manager' && activeBranch
        ? `${activeBranch.fleetManagerName} (Fleet Manager)`
        : senderRole === 'client' && activeContactTarget
          ? `${activeContactTarget.contactPerson} (${activeContactTarget.clientName})`
          : ROLE_CONFIG[senderRole].defaultName;

    onSendMessage({
      branchId: activeContactTarget?.branchId || defaultBranchId,
      dealId: selectedDealId !== 'all' ? selectedDealId : undefined,
      senderName: senderDisplayName,
      senderRole,
      text:
        messageText.trim() ||
        (pendingAttachment?.category === 'site_photo'
          ? 'Отправлено фото строительного объекта.'
          : 'Отправлен файл с реквизитами контрагента.'),
      attachment: pendingAttachment || undefined
    });

    setMessageText('');
    setPendingAttachment(null);
    setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  const buildCompactContextForAgent = () => {
    const chatContext = (filteredMessages.length > 0 ? filteredMessages : messages)
      .slice(-40)
      .map(m => ({
        timestamp: m.timestamp,
        sender: m.senderName,
        role: m.senderRole,
        dealId: m.dealId,
        text: m.text,
        attachment: m.attachment ? `${m.attachment.name} (${m.attachment.category})` : undefined,
        confirmation: m.confirmation
          ? `${m.confirmation.label}: ${m.confirmation.value}${m.confirmation.equipmentName ? ` (${m.confirmation.equipmentName})` : ''}`
          : undefined
      }));

    return {
      branchName: activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Все участки',
      chatMessages: chatContext,
      knowledgeBase: knowledgeDocs.map(doc => ({
        code: doc.code,
        category: doc.category,
        title: doc.title,
        excerpt: doc.excerpt,
        content: doc.fullText.slice(0, 800),
        tags: doc.tags
      })),
      crmDeals: deals.map(d => ({
        id: d.id,
        clientName: d.clientName,
        contactPerson: d.contactPerson,
        phone: d.phone,
        siteAddress: d.siteAddress,
        stage: d.stage,
        equipmentType: d.equipmentType,
        equipmentAssignedId: d.equipmentAssignedId,
        driver: d.assignedDriverName,
        hoursRequested: d.hoursRequested,
        closedShiftHoursTotal: d.closedShiftHoursTotal,
        closedVolumeHours: d.closedVolumeHours,
        rateRub: d.hourlyRateAgreed,
        estimatedAmountRub: d.estimatedAmount,
        debtAmountRub: d.debtAmount,
        invoiceStatus: d.invoiceStatus,
        actNumber: d.actNumber,
        ks2Number: d.ks2Number,
        ks3Number: d.ks3Number
      })),
      rentalOrders: orders.map(o => ({
        orderNumber: o.orderNumber,
        clientName: o.clientName,
        siteAddress: o.siteAddress,
        equipmentId: o.equipmentId,
        operatorName: o.operatorName,
        plannedHours: o.plannedHours,
        actualHours: o.actualHours,
        hourlyRate: o.hourlyRate,
        totalAmountRub: o.totalAmount,
        paidAmountRub: o.paidAmount,
        status: o.status,
        actSigned: o.actSigned,
        invoiceStatus: o.invoiceStatus
      })),
      fleetUnits: equipmentList.map(eq => ({
        inv: eq.inventoryNumber,
        name: eq.name,
        type: eq.type,
        plateNumber: eq.plateNumber,
        status: eq.status,
        assignedSite: eq.assignedSite,
        assignedOperator: eq.assignedOperator,
        hourlyRate: eq.hourlyRate,
        monthHours: eq.monthHours,
        revenueMonth: eq.revenueMonth,
        nextMaintenanceInHours: eq.nextMaintenanceInHours
      })),
      drivers: drivers.map(dr => ({
        name: dr.name,
        phone: dr.phone,
        shiftRoster: dr.shiftRoster,
        assignedEquipmentIds: dr.assignedEquipmentIds
      })),
      legalDocuments: legalDocuments.map(ld => ({
        number: ld.number,
        kind: ld.kind,
        title: ld.title,
        counterparty: ld.counterparty,
        status: ld.status,
        amountRub: ld.amountRub,
        disputeAmountRub: ld.disputeAmountRub
      })),
      closingDocs: closingDocs.map(cd => ({
        kind: cd.kind,
        number: cd.number,
        date: cd.date,
        clientName: cd.clientName,
        totalAmountRub: cd.totalAmountRub,
        invoiceStatus: cd.invoiceStatus
      })),
      shiftReports: shiftReports.slice(0, 25).map(sr => ({
        shiftNumber: sr.shiftNumber,
        date: sr.date,
        equipmentId: sr.equipmentId,
        operatorName: sr.operatorName,
        siteName: sr.siteName,
        workHours: sr.workHours,
        downtimeHours: sr.downtimeHours,
        status: sr.status
      }))
    };
  };

  const handleAskAgent = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? agentQuery).trim();
    if (!q || isAgentLoading) return;

    setIsAgentOpen(true);
    setAgentError(null);
    setLastFailedQuery(null);

    const userTurn: ChatAgentTurn = {
      id: `agent-u-${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: nowTimeShort()
    };

    const nextTurns = [...agentTurns, userTurn];
    setAgentTurns(nextTurns);
    if (!overrideQuery) {
      setAgentQuery('');
    }
    setIsAgentLoading(true);

    setTimeout(() => agentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);

    try {
      const historyPayload = agentTurns.slice(-6).map(t => ({
        role: t.role,
        text: t.text
      }));

      const contextPayload = buildCompactContextForAgent();

      const res = await fetch('/api/chat-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          history: historyPayload,
          ...contextPayload,
          llmConfig: llmConfig
            ? {
                model: llmConfig.model,
                systemInstructionSuffix: llmConfig.systemInstructionSuffix
              }
            : undefined
        })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success || !json.data) {
        const errMessage =
          json?.error || `Ошибка сервера (${res.status}) при обращении к LLM-агенту.`;
        setAgentError(errMessage);
        setLastFailedQuery(q);
        return;
      }

      const assistantTurn: ChatAgentTurn = {
        id: `agent-a-${Date.now()}`,
        role: 'assistant',
        text: json.data.answer || 'Ответ сформирован.',
        chatSummary: json.data.chatSummary || undefined,
        suggestedReply: json.data.suggestedReply || undefined,
        matchedSources: Array.isArray(json.data.matchedSources)
          ? json.data.matchedSources
          : [],
        modelUsed: json.model || 'gemini-4-hydrogen',
        timestamp: nowTimeShort()
      };

      setAgentTurns(prev => [...prev, assistantTurn]);
      setTimeout(() => agentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (err: any) {
      setAgentError(
        err?.message || 'Сетевая ошибка при обращении к LLM-агенту чата.'
      );
      setLastFailedQuery(q);
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleInsertToChatInput = (textToInsert: string) => {
    setMessageText(textToInsert);
    setTimeout(() => messageInputRef.current?.focus(), 40);
  };

  const handleCopyAgentText = (turn: ChatAgentTurn) => {
    const textToCopy = [
      turn.text,
      turn.chatSummary ? `Сводка по чату: ${turn.chatSummary}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedTurnId(turn.id);
    setTimeout(() => setCopiedTurnId(null), 1800);
  };

  const quickAgentPrompts = [
    {
      label: 'Сводка по чату',
      query:
        'Дай общую сводку по переписке в операционном чате: какие подтверждения, реквизиты, фото и открытые вопросы есть сейчас?'
    },
    {
      label: 'Поиск по базе знаний',
      query:
        'Найди в базе знаний ключевые регламенты: нормы расхода ГСМ, правила закрытия смен ЭСМ-7 и порядок оформления КС-2/КС-3.'
    },
    {
      label: 'Техника и долги',
      query:
        'Какие единицы техники сейчас свободны или в ремонте, и по каким заказчикам CRM есть задолженность?'
    },
    {
      label: 'Договоры и счета',
      query:
        'Покажи сводку по действующим договорам, юридическим документам и статусам счетов/актов по участку.'
    }
  ];

  return (
    <div className="p-2.5 space-y-2 max-w-[1680px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeBranch
              ? `Операционный чат: ${activeBranch.name}`
              : 'Операционный чат'}
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            Переписка с объектами, заказчиками и экипажами · встроенный LLM-агент для поиска по базе и сводки по чату
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              handleAskAgent(
                selectedDealId !== 'all'
                  ? 'Сформируй краткую сводку по выбранной сделке в чате: какие сообщения, подтверждения, файлы и статус по базе CRM?'
                  : 'Дай общую информацию по операционному чату: какие ключевые события, подтверждения, файлы и вопросы зафиксированы?'
              )
            }
            disabled={isAgentLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Сводка чата (LLM)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAgentOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              isAgentOpen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-400" />
            <span>{isAgentOpen ? 'Скрыть LLM-агента' : 'Открыть LLM-агента'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Operational Chat + LLM Agent */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-stretch">
        {/* Operational Chat Thread & File Uploader */}
        <div
          className={`${
            isAgentOpen ? 'xl:col-span-7' : 'xl:col-span-12'
          } bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[660px] overflow-hidden shadow-sm`}
        >
          {/* Chat Top Filter Bar */}
          <div className="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[14px] font-semibold text-white shrink-0">
                Чат участка и объектов
              </span>
              <select
                value={selectedDealId}
                onChange={(e) => {
                  setSelectedDealId(e.target.value);
                  if (e.target.value === 'all') {
                    setActiveContactTarget(null);
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 max-w-[260px]"
              >
                <option value="all">Все сообщения ({messages.length})</option>
                {deals.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.clientName} — {d.siteAddress}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">От имени:</span>
              <select
                value={senderRole}
                onChange={(e) => setSenderRole(e.target.value as ChatMessage['senderRole'])}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-300 font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="fleet_manager">Fleet Manager</option>
                <option value="driver">Машинист / Водитель</option>
                <option value="client">Заказчик / Прораб</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>

          {/* Active Contact Context Banner (when jumped from Customer Contact cell) */}
          {activeContactTarget && (
            <div className="px-3 py-2 bg-sky-500/10 border-b border-sky-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-slate-300">
                  Контакт заказчика:{' '}
                  <strong className="text-white">{activeContactTarget.clientName}</strong>
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-sky-200 font-medium">
                  {activeContactTarget.contactPerson}
                </span>
                <span className="font-mono text-sky-300 tabular-nums">
                  {activeContactTarget.phone}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveContactTarget(null);
                    setSelectedDealId('all');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                >
                  Показать все сообщения
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContactTarget(null)}
                  title="Скрыть панель контакта"
                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-[14px] text-center px-4 gap-2">
                <MessageSquare className="w-8 h-8 mb-1 opacity-40" />
                <span>
                  {activeContactTarget
                    ? `По контакту ${activeContactTarget.contactPerson} (${activeContactTarget.clientName}) сообщений пока нет. Напишите сообщение ниже, чтобы начать переписку.`
                    : 'Сообщений пока нет. Отправьте текст, реквизиты или фото объекта.'}
                </span>
                {(selectedDealId !== 'all' || activeContactTarget) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveContactTarget(null);
                      setSelectedDealId('all');
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    Показать все сообщения участка ({messages.length})
                  </button>
                )}
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const roleMeta = ROLE_CONFIG[msg.senderRole];
                const branchCode = branches.find(b => b.id === msg.branchId)?.code;

                return (
                  <div
                    key={msg.id}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-white">{msg.senderName}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[11px] font-mono ${roleMeta.badgeClass}`}>
                          {roleMeta.label}
                        </span>
                        {!activeBranch && branchCode && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 text-[11px] font-mono">
                            {branchCode}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-500">{msg.timestamp}</span>
                    </div>

                    <p className="text-[14px] text-slate-200 leading-relaxed">{msg.text}</p>

                    {/* Attachment Card */}
                    {msg.attachment && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {msg.attachment.previewUrl && msg.attachment.mimeType.startsWith('image/') ? (
                            <img
                              src={msg.attachment.previewUrl}
                              alt={msg.attachment.name}
                              className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              {msg.attachment.category === 'site_photo' ? (
                                <ImageIcon className="w-5 h-5 text-sky-400" />
                              ) : (
                                <FileText className="w-5 h-5 text-amber-400" />
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[11px] font-mono border ${
                                  msg.attachment.category === 'site_photo'
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {msg.attachment.category === 'site_photo' ? 'Фото объекта' : 'Реквизиты / Док.'}
                              </span>
                              <span className="text-[13px] font-medium text-white truncate">
                                {msg.attachment.name}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-400 block mt-0.5">
                              {formatFileSize(msg.attachment.size)}
                            </span>
                          </div>
                        </div>

                        {msg.attachment.previewUrl && (
                          <a
                            href={msg.attachment.previewUrl}
                            download={msg.attachment.name}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition shrink-0"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Скачать</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Confirmation Card (notifications sent from Fleet Manager) */}
                    {msg.confirmation && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[13px] font-bold text-emerald-300 block">
                              {msg.confirmation.label}: {msg.confirmation.value}
                            </span>
                            {(msg.confirmation.equipmentName || msg.confirmation.shiftNumber) && (
                              <span className="text-xs text-slate-300 font-mono">
                                {[msg.confirmation.shiftNumber, msg.confirmation.equipmentName]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono">
                          Подтверждено в Fleet Manager
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Composer + Upload Requisites / Site Photo */}
          <form onSubmit={handleSend} className="p-2.5 bg-slate-950 border-t border-slate-800 space-y-2">
            {/* Pending Attachment Preview */}
            {pendingAttachment && (
              <div className="p-2 rounded-lg bg-slate-900 border border-amber-500/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {pendingAttachment.previewUrl && pendingAttachment.mimeType.startsWith('image/') ? (
                    <img
                      src={pendingAttachment.previewUrl}
                      alt={pendingAttachment.name}
                      className="w-9 h-9 rounded object-cover border border-slate-700"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white truncate block">
                      {pendingAttachment.name}
                    </span>
                    <span className="text-[11px] text-amber-300 font-mono">
                      {pendingAttachment.category === 'site_photo' ? 'Фото объекта' : 'Реквизиты'} ·{' '}
                      {formatFileSize(pendingAttachment.size)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Отправить файл
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {/* File type quick switch */}
              <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAttachmentCategory('requisites')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    attachmentCategory === 'requisites'
                      ? 'bg-amber-500/20 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Реквизиты
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentCategory('site_photo')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    attachmentCategory === 'site_photo'
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Фото объекта
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer shrink-0"
                title="Подгрузить файл с реквизитами или фото объекта"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Подгрузить файл / фото</span>
              </button>

              <input
                ref={messageInputRef}
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Сообщение по объекту, реквизитам или смене..."
                className="flex-1 min-w-[180px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[14px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />

              <button
                type="submit"
                disabled={!messageText.trim() && !pendingAttachment}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправить</span>
              </button>
            </div>
          </form>
        </div>

        {/* LLM Agent Sidebar: Operational Base Search & Chat Overview */}
        {isAgentOpen && (
          <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[660px] overflow-hidden shadow-sm">
            {/* Agent Header */}
            <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[13px] font-bold text-white truncate">
                      LLM-агент чата и базы
                    </h2>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
                      {llmConfig?.model || 'gemini-4-hydrogen'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate tabular-nums">
                    Чат: {messages.length} · База знаний: {knowledgeDocs.length} · CRM: {deals.length} · Парк: {equipmentList.length}
                  </p>
                </div>
              </div>

              {agentTurns.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAgentTurns([]);
                    setAgentError(null);
                  }}
                  title="Очистить историю LLM-диалога"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-1.5">
              {quickAgentPrompts.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isAgentLoading}
                  onClick={() => handleAskAgent(chip.query)}
                  className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            {/* Agent Feed */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {agentTurns.length === 0 && !isAgentLoading && !agentError ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-2.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Search className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-sm font-bold text-white">
                      Оперативный поиск по базе и чату
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Задайте вопрос: агент найдёт данные в переписке чата, сделках CRM, договорах, актах/КС-2/КС-3, заказах, парке техники и базе знаний.
                    </p>
                  </div>
                </div>
              ) : (
                agentTurns.map(turn => {
                  if (turn.role === 'user') {
                    return (
                      <div
                        key={turn.id}
                        className="ml-6 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-100 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-amber-300/80 font-mono">
                          <span>Запрос оператора</span>
                          <span>{turn.timestamp}</span>
                        </div>
                        <p className="leading-relaxed text-[13px] text-white">
                          {turn.text}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={turn.id}
                      className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-amber-300 text-[12px]">
                            LLM-ассистент
                          </span>
                          {turn.modelUsed && (
                            <span className="text-[10px] font-mono text-slate-500">
                              {turn.modelUsed}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-500">
                            {turn.timestamp}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAgentText(turn)}
                            title="Копировать ответ"
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                          >
                            {copiedTurnId === turn.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-line">
                        {turn.text}
                      </div>

                      {turn.chatSummary && (
                        <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-300 block">
                            Сводка по операционному чату
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed">
                            {turn.chatSummary}
                          </p>
                        </div>
                      )}

                      {turn.matchedSources && turn.matchedSources.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block">
                            Найденные данные в базе / чате:
                          </span>
                          <div className="space-y-1">
                            {turn.matchedSources.map((src, idx) => {
                              const meta = SOURCE_TYPE_META[src.sourceType] || {
                                label: src.sourceType || 'База',
                                badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
                              };
                              return (
                                <div
                                  key={idx}
                                  className="p-1.5 rounded bg-slate-900 border border-slate-800/90 flex items-start gap-2 text-[11px]"
                                >
                                  <span
                                    className={`px-1.5 py-0.2 rounded border font-mono text-[10px] shrink-0 ${meta.badgeClass}`}
                                  >
                                    {meta.label}
                                  </span>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-white block truncate">
                                      {src.title}
                                    </span>
                                    <span className="text-slate-400 leading-snug block">
                                      {src.detail}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() =>
                            handleInsertToChatInput(
                              turn.suggestedReply || turn.text
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-[11px] font-semibold cursor-pointer transition"
                        >
                          <CornerDownLeft className="w-3 h-3 text-amber-400" />
                          <span>
                            {turn.suggestedReply
                              ? 'Вставить черновик в чат'
                              : 'Вставить ответ в чат'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {isAgentLoading && (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  <span>Поиск по базе ERP и анализ операционного чата...</span>
                </div>
              )}

              {agentError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{agentError}</span>
                  </div>
                  {lastFailedQuery && (
                    <button
                      type="button"
                      onClick={() => handleAskAgent(lastFailedQuery)}
                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Повторить запрос
                    </button>
                  )}
                </div>
              )}

              <div ref={agentEndRef} />
            </div>

            {/* Agent Query Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleAskAgent();
              }}
              className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5"
            >
              <input
                type="text"
                value={agentQuery}
                onChange={e => setAgentQuery(e.target.value)}
                placeholder="Спросить LLM по базе или чату..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={isAgentLoading || !agentQuery.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {isAgentLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Найти</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
