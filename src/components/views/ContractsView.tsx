import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Scale,
  FileText,
  History,
  BookTemplate,
  AlertTriangle,
  Plus,
  Upload,
  Download,
  Database,
  ExternalLink,
  Search,
  CheckCircle2,
  Lock,
  Save,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import {
  anonymizeLegalText,
  exportSingleLegalDoc,
  SingleDocExportFormat
} from '../../utils/legalDocExport';
import {
  AccountingSubjectId,
  FleetBranch,
  KnowledgeDoc,
  LegalDocKind,
  LegalDocStatus,
  LegalDocument,
  LegalHistoryEntry,
  LegalRole
} from '../../types';

interface ContractsViewProps {
  documents: LegalDocument[];
  history: LegalHistoryEntry[];
  knowledgeDocs: KnowledgeDoc[];
  branches: FleetBranch[];
  activeBranch: FleetBranch | null;
  currentRole: LegalRole;
  onChangeRole?: (role: LegalRole) => void;
  onCreateDocument: (doc: LegalDocument, actorRole: LegalRole, actorName: string) => void;
  onUpdateDocument: (doc: LegalDocument, actorRole: LegalRole, actorName: string, actionDetails?: string) => void;
  onImportDocuments: (docs: LegalDocument[], actorRole: LegalRole, actorName: string) => void;
  onSaveToKnowledgeBase: (
    doc: LegalDocument,
    actorRole: LegalRole,
    actorName: string,
    options?: {
      mode: 'anonymized' | 'full';
      targetCategory: KnowledgeDoc['category'];
    }
  ) => void;
  onLogExport: (details: string, doc: LegalDocument | null, actorRole: LegalRole, actorName: string) => void;
  onOpenKnowledgeBase: () => void;
  requestedTab?: { tab: LawyerTab; docCode?: string; nonce: number } | null;
}

export type LawyerTab = 'registry' | 'history' | 'templates' | 'disputes';

const ROLE_META: Record<
  LegalRole,
  { label: string; userName: string; canEdit: boolean; accessText: string }
> = {
  admin: {
    label: 'Admin',
    userName: 'Администратор системы',
    canEdit: true,
    accessText: 'Просмотр и изменение'
  },
  top_manager: {
    label: 'Top Manager',
    userName: 'Генеральный директор',
    canEdit: true,
    accessText: 'Просмотр и изменение'
  },
  lawyer: {
    label: 'Lawyer (Юрист)',
    userName: 'Воронова Е. В. (Юрист)',
    canEdit: true,
    accessText: 'Просмотр и изменение'
  },
  accountant: {
    label: 'Accountant (Бухгалтер)',
    userName: 'Главный бухгалтер',
    canEdit: false,
    accessText: 'Только просмотр'
  }
};

const KIND_LABELS: Record<LegalDocKind, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  dispute: 'Спор',
  claim: 'Претензия',
  template: 'Шаблон'
};

const STATUS_LABELS: Record<LegalDocStatus, string> = {
  draft: 'Черновик',
  review: 'На согласовании',
  active: 'Действует',
  dispute: 'В споре / Претензия',
  resolved: 'Урегулирован',
  archived: 'Архив'
};

const STATUS_STYLES: Record<LegalDocStatus, string> = {
  draft: 'text-slate-300',
  review: 'text-amber-300',
  active: 'text-emerald-400',
  dispute: 'text-rose-400',
  resolved: 'text-sky-300',
  archived: 'text-slate-500'
};

const ACTION_LABELS: Record<LegalHistoryEntry['action'], string> = {
  created: 'Создан документ',
  updated: 'Обновлён текст / реквизиты',
  imported: 'Импорт документа',
  exported: 'Экспорт документов / базы',
  saved_to_base: 'Сохранён в полную базу',
  status_changed: 'Изменён статус',
  dispute_opened: 'Открыт спор / претензия'
};

export const ContractsView: React.FC<ContractsViewProps> = ({
  documents,
  history,
  knowledgeDocs,
  branches,
  activeBranch,
  currentRole,
  onCreateDocument,
  onUpdateDocument,
  onImportDocuments,
  onSaveToKnowledgeBase,
  onLogExport,
  onOpenKnowledgeBase,
  requestedTab
}) => {
  const [activeTab, setActiveTab] = useState<LawyerTab>(requestedTab?.tab || 'registry');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    if (requestedTab?.docCode) {
      const matched = documents.find(d => d.number === requestedTab.docCode);
      if (matched) return matched.id;
    }
    return documents[0]?.id || '';
  });

  const lastRequestedNonceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!requestedTab) return;
    const isNewRequest = lastRequestedNonceRef.current !== requestedTab.nonce;
    if (isNewRequest) {
      lastRequestedNonceRef.current = requestedTab.nonce;
      setActiveTab(requestedTab.tab);
      setIsEditingContent(false);
      setSearchQuery('');
      setStatusFilter('all');
    }
    if (requestedTab.docCode) {
      const matched = documents.find(
        d => d.number === requestedTab.docCode || d.linkedOrderNumber === requestedTab.docCode
      );
      if (matched) {
        setSelectedDocId(matched.id);
      }
    } else if (isNewRequest && requestedTab.tab === 'templates') {
      const firstTpl = documents.find(d => d.kind === 'template');
      if (firstTpl) setSelectedDocId(firstTpl.id);
    }
  }, [requestedTab, documents]);

  // Create Document Form Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newNumber, setNewNumber] = useState('');
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<LegalDocKind>('contract');
  const [newBranchId, setNewBranchId] = useState<string>(
    activeBranch?.id || branches[0]?.id || 'branch-hq'
  );
  const [newCounterparty, setNewCounterparty] = useState('');
  const [newSubject, setNewSubject] = useState<AccountingSubjectId>('ooo_specialtech');
  const [newAmount, setNewAmount] = useState<number>(500000);
  const [newDisputeAmount, setNewDisputeAmount] = useState<number>(0);
  const [newDisputeReason, setNewDisputeReason] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  // Editable reader state
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isReaderExpanded, setIsReaderExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftDisputeReason, setDraftDisputeReason] = useState('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Targeted single-document export dialog state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTargetDocId, setExportTargetDocId] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<SingleDocExportFormat>('docx');
  const [exportIncludeMetadata, setExportIncludeMetadata] = useState<boolean>(true);
  const [exportAnonymize, setExportAnonymize] = useState<boolean>(false);

  // Deliberate transfer to shared "База знаний" dialog state
  const [isKbTransferModalOpen, setIsKbTransferModalOpen] = useState(false);
  const [kbTransferDocId, setKbTransferDocId] = useState<string>('');
  const [kbTransferMode, setKbTransferMode] = useState<'anonymized' | 'full'>('anonymized');
  const [kbTransferCategory, setKbTransferCategory] = useState<KnowledgeDoc['category']>('contracts');
  const [kbTransferConfirmed, setKbTransferConfirmed] = useState<boolean>(false);

  const importFileRef = useRef<HTMLInputElement>(null);

  const roleInfo = ROLE_META[currentRole];
  const canEdit = roleInfo.canEdit;

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3500);
  };

  const registryDocs = useMemo(
    () => documents.filter(d => d.kind !== 'template'),
    [documents]
  );

  const templateDocs = useMemo(
    () => documents.filter(d => d.kind === 'template'),
    [documents]
  );

  const availableTemplates = useMemo(() => {
    const seenCodes = new Set(templateDocs.map(t => t.number));
    const merged = templateDocs.map(t => ({
      id: t.id,
      number: t.number,
      title: t.title,
      content: t.content,
      branchId: t.branchId,
      accountingSubject: t.accountingSubject
    }));
    knowledgeDocs
      .filter(k => k.category === 'templates' && !seenCodes.has(k.code))
      .forEach(k => {
        merged.push({
          id: k.id,
          number: k.code,
          title: k.title,
          content: k.fullText,
          branchId: activeBranch?.id || branches[0]?.id || 'branch-hq',
          accountingSubject: 'ooo_specialtech'
        });
      });
    return merged;
  }, [templateDocs, knowledgeDocs, activeBranch, branches]);

  const disputeDocs = useMemo(
    () =>
      documents.filter(
        d => d.kind === 'dispute' || d.kind === 'claim' || d.status === 'dispute'
      ),
    [documents]
  );

  const filteredList = useMemo(() => {
    const source =
      activeTab === 'templates'
        ? templateDocs
        : activeTab === 'disputes'
        ? disputeDocs
        : registryDocs;

    const q = searchQuery.trim().toLowerCase();
    return source.filter(doc => {
      const matchesSearch =
        !q ||
        doc.number.toLowerCase().includes(q) ||
        doc.title.toLowerCase().includes(q) ||
        doc.counterparty.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeTab, registryDocs, templateDocs, disputeDocs, searchQuery, statusFilter]);

  const selectedDoc =
    documents.find(d => d.id === selectedDocId) || filteredList[0] || documents[0] || null;

  const totalDisputeAmount = disputeDocs.reduce(
    (sum, d) => sum + (d.disputeAmountRub || 0),
    0
  );
  const savedInBaseCount = documents.filter(d => d.inKnowledgeBase).length;

  const todayIso = () => new Date().toISOString().split('T')[0];

  const buildAutoDocNumber = (kind: LegalDocKind, branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    const branchCode = branch?.code || 'MSK';
    const rawOrderPrefix = branch?.documentFlow.orderPrefix?.trim() || `ДОГ-${branchCode}-`;
    const normalizedOrderPrefix =
      rawOrderPrefix.endsWith('-') || rawOrderPrefix.endsWith('/')
        ? rawOrderPrefix
        : `${rawOrderPrefix}-`;
    const prefixMap: Record<LegalDocKind, string> = {
      contract: `${normalizedOrderPrefix}2026/`,
      addendum: `ДС-${branchCode}-2026/`,
      dispute: `СПР-${branchCode}-2026/`,
      claim: `ПРТ-${branchCode}-2026/`,
      template: `ШАБ-2026/`
    };
    return `${prefixMap[kind]}${String(documents.length + 10).padStart(3, '0')}`;
  };

  const applyNumberToContent = (text: string, oldNumber: string, nextNumber: string) => {
    if (!oldNumber || oldNumber === nextNumber) return text;
    return text.split(`ДОКУМЕНТ № ${oldNumber}`).join(`ДОКУМЕНТ № ${nextNumber}`);
  };

  const MONTHS_GENITIVE_RU = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря'
  ];

  const formatLegalDateRu = (isoDate: string) => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [year, monthStr, day] = parts;
    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthName = MONTHS_GENITIVE_RU[monthIdx];
    if (!monthName) return isoDate;
    return `«${day.padStart(2, '0')}» ${monthName} ${year} г.`;
  };

  const applyDateToContent = (text: string, isoDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return text;
    const legalDate = formatLegalDateRu(isoDate);
    const ruHeaderDatePattern =
      '«(?:\\[ДД\\]|\\d{2})»\\s+(?:\\[МЕСЯЦ\\]|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\\s+\\d{4}\\s+г\\.';

    let updated = text.replace(
      new RegExp(`^((?:г\\.\\s*[^\\n]*?\\s+|Дата:\\s*))${ruHeaderDatePattern}`, 'm'),
      `$1${legalDate}`
    );
    updated = updated.replace(/«\[ДД\]»\s+\[МЕСЯЦ\]\s+\d{4}\s+г\./g, legalDate);
    updated = updated.replace(/^(Дата:\s*)\d{4}-\d{2}-\d{2}/m, `$1${isoDate}`);
    return updated;
  };

  const handleOpenCreateModal = (preset?: Partial<LegalDocument> & { templateId?: string }) => {
    if (!canEdit) return;
    const targetBranchId = preset?.branchId || activeBranch?.id || branches[0]?.id || 'branch-hq';
    const kind =
      preset?.kind ||
      (activeTab === 'disputes' ? 'dispute' : activeTab === 'templates' ? 'template' : 'contract');
    const autoNum = buildAutoDocNumber(kind, targetBranchId);
    const docDate = preset?.createdAt || todayIso();

    setSelectedTemplateId(preset?.templateId || '');
    setNewKind(kind);
    setNewNumber(autoNum);
    setNewDate(docDate);
    setNewTitle(preset?.title || '');
    setNewBranchId(targetBranchId);
    setNewCounterparty(preset?.counterparty && !preset.counterparty.startsWith('Типовой') ? preset.counterparty : '');
    setNewSubject(preset?.accountingSubject || 'ooo_specialtech');
    setNewAmount(preset?.amountRub || 500000);
    setNewDisputeAmount(preset?.disputeAmountRub || 0);
    setNewDisputeReason(preset?.disputeReason || '');
    setNewContent(
      preset?.content
        ? applyDateToContent(preset.content, docDate)
        : `ДОКУМЕНТ № ${autoNum}\nДата: ${docDate}\n\n1. Стороны и предмет соглашения:\n2. Стоимость услуг и порядок закрытия ЭСМ-7 / КС-2:\n3. Порядок урегулирования разногласий и споров:`
    );
    setIsContentExpanded(false);
    setIsCreateOpen(true);
  };

  const handleDateChangeInForm = (nextDate: string) => {
    setNewDate(nextDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    setNewContent(prev => applyDateToContent(prev, nextDate));
  };

  const handleSelectTemplateInForm = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;
    const tpl = availableTemplates.find(t => t.id === tplId);
    if (!tpl) return;

    const cleanTitle = tpl.title.replace(/^Шаблон:\s*/i, '');
    const isClaimTemplate =
      tpl.number.toUpperCase().includes('ПРЕТЕНЗ') ||
      cleanTitle.toLowerCase().includes('претенз');
    const nextKind: LegalDocKind = isClaimTemplate ? 'claim' : 'contract';
    const docDate = /^\d{4}-\d{2}-\d{2}$/.test(newDate) ? newDate : todayIso();

    setNewKind(nextKind);
    setNewNumber(buildAutoDocNumber(nextKind, tpl.branchId || newBranchId));
    setNewTitle(cleanTitle);
    setNewBranchId(tpl.branchId || newBranchId);
    setNewSubject(tpl.accountingSubject || newSubject);
    setNewContent(applyDateToContent(tpl.content, docDate));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newTitle.trim()) return;

    const docDate = newDate || todayIso();
    const doc: LegalDocument = {
      id: `leg-${Date.now().toString().slice(-5)}`,
      number: newNumber.trim() || `ДОГ-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      kind: newKind,
      branchId: newBranchId,
      counterparty: newCounterparty.trim() || 'Не указан',
      accountingSubject: newSubject,
      status: newKind === 'dispute' || newKind === 'claim' ? 'dispute' : newKind === 'template' ? 'active' : 'draft',
      createdAt: docDate,
      updatedAt: docDate,
      authorName: roleInfo.userName,
      amountRub: newAmount,
      disputeAmountRub: newKind === 'dispute' || newKind === 'claim' ? newDisputeAmount : undefined,
      disputeReason: newKind === 'dispute' || newKind === 'claim' ? newDisputeReason.trim() : undefined,
      inKnowledgeBase: false,
      content: newContent.trim()
    };

    onCreateDocument(doc, currentRole, roleInfo.userName);
    setActiveTab(
      doc.kind === 'template'
        ? 'templates'
        : doc.kind === 'dispute' || doc.kind === 'claim'
        ? 'disputes'
        : 'registry'
    );
    setStatusFilter('all');
    setSearchQuery('');
    setIsEditingContent(false);
    setSelectedDocId(doc.id);
    setIsCreateOpen(false);
    showNotice(`Создан документ ${doc.number} и добавлен в реестр.`);
  };

  const handleStartEdit = () => {
    if (!canEdit || !selectedDoc) return;
    setDraftTitle(selectedDoc.title);
    setDraftContent(selectedDoc.content);
    setDraftDisputeReason(selectedDoc.disputeReason || '');
    setIsEditingContent(true);
  };

  const handleSaveEdit = () => {
    if (!canEdit || !selectedDoc) return;
    onUpdateDocument(
      {
        ...selectedDoc,
        title: draftTitle.trim() || selectedDoc.title,
        content: draftContent,
        disputeReason: draftDisputeReason.trim() || selectedDoc.disputeReason,
        updatedAt: todayIso()
      },
      currentRole,
      roleInfo.userName,
      'Сохранены изменения текста и реквизитов документа'
    );
    setIsEditingContent(false);
    showNotice(`Изменения по документу ${selectedDoc.number} сохранены.`);
  };

  const handleStatusChange = (nextStatus: LegalDocStatus) => {
    if (!canEdit || !selectedDoc) return;
    onUpdateDocument(
      {
        ...selectedDoc,
        status: nextStatus,
        updatedAt: todayIso()
      },
      currentRole,
      roleInfo.userName,
      `Статус изменён на «${STATUS_LABELS[nextStatus]}»`
    );
    showNotice(`Статус документа ${selectedDoc.number}: ${STATUS_LABELS[nextStatus]}`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const importedDocs: LegalDocument[] = [];
    const nowDate = todayIso();
    const defaultBranchId = activeBranch?.id || branches[0]?.id || 'branch-hq';

    try {
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        rows.forEach((row, idx) => {
          const title = String(row['Название'] || row['Наименование'] || row['title'] || `${file.name} #${idx + 1}`);
          const number = String(row['Номер'] || row['number'] || `ИМП-${Date.now().toString().slice(-4)}-${idx + 1}`);
          const counterparty = String(row['Контрагент'] || row['Заказчик'] || row['counterparty'] || 'Импортированный контрагент');
          const amount = Number(row['Сумма'] || row['amountRub'] || 0) || 0;
          const content = String(row['Текст'] || row['Содержание'] || row['content'] || `Импортировано из таблицы ${file.name}`);
          importedDocs.push({
            id: `leg-imp-${Date.now()}-${idx}`,
            number,
            title,
            kind: 'contract',
            branchId: defaultBranchId,
            counterparty,
            accountingSubject: 'ooo_specialtech',
            status: 'review',
            createdAt: nowDate,
            updatedAt: nowDate,
            authorName: roleInfo.userName,
            amountRub: amount,
            inKnowledgeBase: false,
            content
          });
        });
      } else {
        const text = await file.text();
        if (ext === 'json') {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          arr.forEach((item, idx) => {
            importedDocs.push({
              id: `leg-imp-${Date.now()}-${idx}`,
              number: String(item.number || `ИМП-${Date.now().toString().slice(-4)}`),
              title: String(item.title || file.name),
              kind: (item.kind as LegalDocKind) || 'contract',
              branchId: String(item.branchId || defaultBranchId),
              counterparty: String(item.counterparty || 'Контрагент из файла'),
              accountingSubject: (item.accountingSubject as AccountingSubjectId) || 'ooo_specialtech',
              status: 'review',
              createdAt: nowDate,
              updatedAt: nowDate,
              authorName: roleInfo.userName,
              amountRub: Number(item.amountRub) || 0,
              inKnowledgeBase: false,
              content: String(item.content || text)
            });
          });
        } else {
          importedDocs.push({
            id: `leg-imp-${Date.now()}`,
            number: `ИМП-${Date.now().toString().slice(-4)}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            kind: 'contract',
            branchId: defaultBranchId,
            counterparty: 'Загружено из файла',
            accountingSubject: 'ooo_specialtech',
            status: 'review',
            createdAt: nowDate,
            updatedAt: nowDate,
            authorName: roleInfo.userName,
            amountRub: 0,
            inKnowledgeBase: false,
            content: text || `Файл ${file.name} импортирован.`
          });
        }
      }

      if (importedDocs.length > 0) {
        onImportDocuments(importedDocs, currentRole, roleInfo.userName);
        setSelectedDocId(importedDocs[0].id);
        showNotice(`Импортировано документов: ${importedDocs.length} (из файла ${file.name})`);
      } else {
        showNotice(`Файл ${file.name} не содержит строк для импорта.`);
      }
    } catch {
      showNotice(`Не удалось прочитать файл ${file.name}. Поддерживаются .xlsx, .csv, .txt, .json.`);
    } finally {
      e.target.value = '';
    }
  };

  const SINGLE_FORMAT_LABELS: Record<SingleDocExportFormat, string> = {
    docx: 'Word (.docx)',
    pdf: 'PDF / Печать (.pdf)',
    xlsx: 'Excel (.xlsx)',
    txt: 'Текст (.txt)',
    html: 'Веб-документ (.html)',
    json: 'JSON (.json)'
  };

  const SINGLE_FORMAT_HINTS: Record<SingleDocExportFormat, string> = {
    docx: 'Оформленный документ Microsoft Word с шапкой и текстом',
    pdf: 'Чистая печатная форма A4 для сохранения в PDF или печати',
    xlsx: 'Книга Excel с карточкой реквизитов и строками текста',
    txt: 'Обычный текстовый файл в кодировке UTF-8',
    html: 'Автономный веб-документ для браузера',
    json: 'Структурированные данные документа (подходит для повторного импорта)'
  };

  const exportTargetDoc =
    documents.find(d => d.id === exportTargetDocId) || selectedDoc || null;

  const kbTransferDoc =
    documents.find(d => d.id === kbTransferDocId) || selectedDoc || null;

  const handleOpenTargetedExport = (doc?: LegalDocument | null) => {
    const target = doc || selectedDoc || filteredList[0] || documents[0];
    if (!target) {
      showNotice('Нет выбранного документа для экспорта.');
      return;
    }
    setExportTargetDocId(target.id);
    setExportFormat('docx');
    setExportIncludeMetadata(true);
    setExportAnonymize(false);
    setIsExportModalOpen(true);
  };

  const handleConfirmTargetedExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportTargetDoc) return;
    const branchName =
      branches.find(b => b.id === exportTargetDoc.branchId)?.name || exportTargetDoc.branchId;
    await exportSingleLegalDoc(exportTargetDoc, exportFormat, branchName, {
      includeMetadata: exportIncludeMetadata,
      anonymize: exportAnonymize
    });
    onLogExport(
      `Таргетированный экспорт документа ${exportTargetDoc.number} (${SINGLE_FORMAT_LABELS[exportFormat]}${
        exportAnonymize ? ', обезличен' : ''
      })`,
      exportTargetDoc,
      currentRole,
      roleInfo.userName
    );
    setIsExportModalOpen(false);
    showNotice(
      `Документ ${exportTargetDoc.number} экспортирован: ${SINGLE_FORMAT_LABELS[exportFormat]}`
    );
  };

  const handleOpenKbTransferModal = (doc?: LegalDocument | null) => {
    if (!canEdit) return;
    const target = doc || selectedDoc;
    if (!target) return;
    setKbTransferDocId(target.id);
    setKbTransferMode(target.kind === 'template' ? 'full' : 'anonymized');
    setKbTransferCategory(
      target.kind === 'template'
        ? 'templates'
        : target.kind === 'dispute' || target.kind === 'claim' || target.status === 'dispute'
        ? 'disputes'
        : 'contracts'
    );
    setKbTransferConfirmed(false);
    setIsKbTransferModalOpen(true);
  };

  const handleConfirmKbTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !kbTransferDoc || !kbTransferConfirmed) return;
    onSaveToKnowledgeBase(kbTransferDoc, currentRole, roleInfo.userName, {
      mode: kbTransferMode,
      targetCategory: kbTransferCategory
    });
    setIsKbTransferModalOpen(false);
    showNotice(
      kbTransferMode === 'anonymized'
        ? `Обезличенный образец документа ${kbTransferDoc.number} передан в «Базу знаний».`
        : `Документ ${kbTransferDoc.number} передан в «Базу знаний».`
    );
  };

  return (
    <div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      {/* Header + Isolated Legal Base Badge + Knowledge Base Link */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400 mb-1">
              <Scale className="w-4 h-4" />
              <span>Рабочее место юриста · Изолированная конфиденциальная база документов</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Договора, реестр, шаблоны и споры
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Закрытый контур хранения договоров, доп. соглашений, претензий и споров с персональными данными и реквизитами контрагентов
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Изолированная база юриста</span>
            </span>

            {/* Link to Shared Knowledge Base ("База знаний") */}
            <button
              type="button"
              onClick={onOpenKnowledgeBase}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span>База знаний ({knowledgeDocs.length})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar: Create, Import, Targeted Export, Deliberate KB Transfer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => handleOpenCreateModal()}
              title={canEdit ? 'Создать новый документ' : 'Роль Accountant имеет доступ только к просмотру'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {canEdit ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Создать документ</span>
            </button>

            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => importFileRef.current?.click()}
              title={canEdit ? 'Импортировать документ в изолированную базу юриста (.xlsx, .csv, .txt, .json)' : 'Недоступно для роли Accountant'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Импорт документов</span>
            </button>

            <button
              type="button"
              disabled={!selectedDoc}
              onClick={() => handleOpenTargetedExport(selectedDoc)}
              title={
                selectedDoc
                  ? `Осознанный экспорт документа ${selectedDoc.number}`
                  : 'Выберите документ для экспорта'
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {selectedDoc ? `Экспорт: ${selectedDoc.number}` : 'Экспортировать документ'}
              </span>
            </button>

            <button
              type="button"
              disabled={!canEdit || !selectedDoc}
              onClick={() => handleOpenKbTransferModal(selectedDoc)}
              title={
                canEdit
                  ? 'Осознанно передать выбранный документ (с обезличиванием или как шаблон) в «Базу знаний»'
                  : 'Недоступно для роли Accountant'
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-semibold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Передать в Базу знаний</span>
            </button>
          </div>

          {noticeMessage && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Документов в реестре</span>
          <span className="text-xl font-bold text-white num-mono">{registryDocs.length}</span>
          <span className="text-xs text-slate-400 block mt-0.5">Договоры, доп. соглашения, претензии</span>
        </div>
        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Активные споры и претензии</span>
          <span className="text-xl font-bold text-rose-400 num-mono">
            {disputeDocs.length} · {totalDisputeAmount.toLocaleString()} ₽
          </span>
          <span className="text-xs text-slate-400 block mt-0.5">Разбор разногласий и долгов</span>
        </div>
        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Юридических шаблонов</span>
          <span className="text-xl font-bold text-amber-400 num-mono">{templateDocs.length}</span>
          <span className="text-xs text-slate-400 block mt-0.5">Готовые формы для сделок</span>
        </div>
        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Изолированная база юриста</span>
          <span className="text-xl font-bold text-emerald-400 num-mono">
            {documents.length} док.
          </span>
          <span className="text-xs text-slate-400 block mt-0.5">
            В Базу знаний передано: {savedInBaseCount} · Остальные закрыты
          </span>
        </div>
      </div>

      {/* Create Document Form */}
      {isCreateOpen && canEdit && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-sm font-bold text-amber-300">
              Создание юридического документа
            </h2>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-medium mb-1">Вид документа</label>
              <select
                value={newKind}
                onChange={(e) => {
                  const nextKind = e.target.value as LegalDocKind;
                  const nextNum = buildAutoDocNumber(nextKind, newBranchId);
                  const prevNum = newNumber;
                  setNewKind(nextKind);
                  setNewNumber(nextNum);
                  setNewContent(prev => applyNumberToContent(prev, prevNum, nextNum));
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="contract">Договор</option>
                <option value="addendum">Доп. соглашение</option>
                <option value="dispute">Спор</option>
                <option value="claim">Претензия</option>
                <option value="template">Шаблон</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-slate-300 font-medium mb-1">Шаблоны</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplateInForm(e.target.value)}
                className="w-full bg-slate-800 border border-amber-500/40 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">— Без шаблона —</option>
                {availableTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.number} · {tpl.title.replace(/^Шаблон:\s*/i, '')}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-medium mb-1">Номер документа</label>
              <input
                type="text"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-slate-300 font-medium mb-1">Наименование документа</label>
              <input
                type="text"
                placeholder="Например: Договор аренды автокрана №18"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-medium mb-1">Дата документа</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => handleDateChangeInForm(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-slate-300 font-medium mb-1">Контрагент</label>
              <input
                type="text"
                placeholder="ООО «СтройГрупп»"
                value={newCounterparty}
                onChange={(e) => setNewCounterparty(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-slate-300 font-medium mb-1">Участок / филиал</label>
              <select
                value={newBranchId}
                onChange={(e) => {
                  const nextBranchId = e.target.value;
                  const nextNum = buildAutoDocNumber(newKind, nextBranchId);
                  const prevNum = newNumber;
                  setNewBranchId(nextBranchId);
                  setNewNumber(nextNum);
                  setNewContent(prev => applyNumberToContent(prev, prevNum, nextNum));
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-medium mb-1">Субъект 1С</label>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value as AccountingSubjectId)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="ooo_specialtech">ООО «SpecialTech»</option>
                <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-medium mb-1">
                {newKind === 'dispute' || newKind === 'claim' ? 'Сумма спора (₽)' : 'Сумма договора (₽)'}
              </label>
              <input
                type="number"
                min={0}
                value={newKind === 'dispute' || newKind === 'claim' ? newDisputeAmount : newAmount}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  if (newKind === 'dispute' || newKind === 'claim') {
                    setNewDisputeAmount(val);
                  } else {
                    setNewAmount(val);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {(newKind === 'dispute' || newKind === 'claim') && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Суть и основание спора</label>
              <input
                type="text"
                placeholder="Например: расхождение по моточасам ЭСМ-7 или просрочка оплаты более 14 дней"
                value={newDisputeReason}
                onChange={(e) => setNewDisputeReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-slate-300 font-medium">Текст документа</label>
              <button
                type="button"
                onClick={() => setIsContentExpanded(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-semibold transition cursor-pointer"
              >
                {isContentExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Свернуть поле</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Развернуть (×4)</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={isContentExpanded ? 20 : 5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className={`w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 font-sans leading-relaxed focus:outline-none focus:border-amber-500 resize-y transition-all ${
                isContentExpanded ? 'h-[512px]' : 'h-[128px]'
              }`}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
            >
              Создать и внести в реестр
            </button>
          </div>
        </form>
      )}

      {/* Main 4 Section Tabs: Реестр, История, Шаблоны, Споры */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'registry' as const, label: `Реестр (${registryDocs.length})`, icon: FileText },
            { id: 'history' as const, label: `История (${history.length})`, icon: History },
            { id: 'templates' as const, label: `Шаблоны (${templateDocs.length})`, icon: BookTemplate },
            { id: 'disputes' as const, label: `Споры (${disputeDocs.length})`, icon: AlertTriangle }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsEditingContent(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab !== 'history' && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Поиск по номеру, контрагенту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="review">На согласовании</option>
              <option value="active">Действует</option>
              <option value="dispute">В споре / Претензия</option>
              <option value="resolved">Урегулирован</option>
              <option value="archived">Архив</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB: ИСТОРИЯ */}
      {activeTab === 'history' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              История изменений, импорта, экспорта и публикаций в базу
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              Записей: {history.length}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Журнал истории пуст.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 bg-slate-950/60 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Дата и время</th>
                    <th className="py-2.5 px-4 font-medium">Документ</th>
                    <th className="py-2.5 px-4 font-medium">Операция</th>
                    <th className="py-2.5 px-4 font-medium">Роль / Пользователь</th>
                    <th className="py-2.5 px-4 font-medium">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        {item.timestamp}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-mono text-amber-300 font-semibold">{item.documentNumber}</div>
                        <div className="text-slate-200 max-w-xs truncate">{item.documentTitle}</div>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-white">
                        {ACTION_LABELS[item.action]}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="text-slate-200">{item.actorName}</div>
                        <div className="text-[11px] font-mono text-sky-400">{item.actorRole}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">{item.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* TABS: РЕЕСТР, ШАБЛОНЫ, СПОРЫ — 2-Column Split (List + Document Viewer/Editor) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Document List */}
          {!isReaderExpanded && (
            <div className="lg:col-span-4 space-y-2">
              {filteredList.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
                  <p>Документы по текущему фильтру не найдены.</p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Создать документ</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredList.map(doc => {
                  const isSelected = selectedDoc?.id === doc.id;
                  const branch = branches.find(b => b.id === doc.branchId);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setIsEditingContent(false);
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer space-y-1.5 text-xs ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/60'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-amber-400 font-bold">{doc.number}</span>
                          <span aria-hidden="true">·</span>
                          <span>{KIND_LABELS[doc.kind]}</span>
                          {branch && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{branch.code}</span>
                            </>
                          )}
                        </div>
                        <span className={`font-semibold ${STATUS_STYLES[doc.status]}`}>
                          {STATUS_LABELS[doc.status]}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white leading-snug">
                        {doc.title}
                      </h3>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 pt-0.5">
                        <span>{doc.counterparty}</span>
                        <span className="font-mono text-slate-200 tabular-nums">
                          {doc.disputeAmountRub
                            ? `Спор: ${doc.disputeAmountRub.toLocaleString()} ₽`
                            : doc.amountRub > 0
                            ? `${doc.amountRub.toLocaleString()} ₽`
                            : 'Шаблон'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Дата: {doc.createdAt}{doc.updatedAt !== doc.createdAt ? ` · Обновлён: ${doc.updatedAt}` : ''}</span>
                        <span>
                          {doc.inKnowledgeBase
                            ? 'Есть образец в Базе знаний'
                            : 'Изолированная база юриста'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Right: Document Reader / Editor */}
          <div
            className={`${
              isReaderExpanded ? 'lg:col-span-12 border-amber-500/40' : 'lg:col-span-8 border-slate-800'
            } bg-slate-900 border rounded-xl p-4 space-y-3 text-xs transition-all`}
          >
            {!selectedDoc ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <p>Выберите документ из списка слева для просмотра или редактирования.</p>
                {isReaderExpanded && (
                  <button
                    type="button"
                    onClick={() => setIsReaderExpanded(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Вернуть список документов</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-amber-400 font-bold">{selectedDoc.number}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">от {selectedDoc.createdAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>{KIND_LABELS[selectedDoc.kind]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedDoc.counterparty}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {selectedDoc.accountingSubject === 'ip_specialtechnica'
                          ? 'ИП SpecialTechnica'
                          : 'ООО SpecialTech'}
                      </span>
                    </div>
                    {isEditingContent ? (
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-base font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <h2 className="text-base font-bold text-white">{selectedDoc.title}</h2>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedDoc.kind === 'template' && (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          handleOpenCreateModal({
                            kind: selectedDoc.number.toUpperCase().includes('ПРЕТЕНЗ') ? 'claim' : 'contract',
                            branchId: selectedDoc.branchId,
                            accountingSubject: selectedDoc.accountingSubject,
                            title: selectedDoc.title.replace(/^Шаблон:\s*/i, ''),
                            content: selectedDoc.content,
                            templateId: selectedDoc.id
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Создать по шаблону</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenTargetedExport(selectedDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold transition cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Экспорт документа</span>
                    </button>

                    {!isEditingContent ? (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={handleStartEdit}
                        title={canEdit ? 'Редактировать документ' : 'Роль Accountant — только просмотр'}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <span>Редактировать</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Сохранить правки</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingContent(false)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold transition cursor-pointer whitespace-nowrap"
                        >
                          <span>Отмена</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsReaderExpanded(prev => !prev)}
                      title={
                        isReaderExpanded
                          ? 'Свернуть область просмотра и вернуть список документов'
                          : 'Развернуть область просмотра и редактирования на всю ширину'
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold transition cursor-pointer whitespace-nowrap"
                    >
                      {isReaderExpanded ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5" />
                          <span>Свернуть</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Развернуть</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status & Dispute Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Статус документа:</span>
                    <select
                      disabled={!canEdit}
                      value={selectedDoc.status}
                      onChange={(e) => handleStatusChange(e.target.value as LegalDocStatus)}
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300">
                    {selectedDoc.amountRub > 0 && (
                      <span>Сумма: {selectedDoc.amountRub.toLocaleString()} ₽</span>
                    )}
                    {selectedDoc.disputeAmountRub ? (
                      <span className="text-rose-400 font-bold">
                        Спор: {selectedDoc.disputeAmountRub.toLocaleString()} ₽
                      </span>
                    ) : null}
                  </div>
                </div>

                {(selectedDoc.disputeReason || isEditingContent) &&
                  (selectedDoc.kind === 'dispute' || selectedDoc.kind === 'claim' || selectedDoc.status === 'dispute') && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1">
                      <div className="font-semibold text-rose-300">Основание спора / претензии:</div>
                      {isEditingContent ? (
                        <input
                          type="text"
                          value={draftDisputeReason}
                          onChange={(e) => setDraftDisputeReason(e.target.value)}
                          className="w-full bg-slate-900 border border-rose-500/40 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none"
                        />
                      ) : (
                        <p className="text-rose-200/90">{selectedDoc.disputeReason}</p>
                      )}
                    </div>
                  )}

                {/* Document Body */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>
                      {isEditingContent ? 'Режим редактирования текста документа' : 'Текст документа'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsReaderExpanded(prev => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold transition cursor-pointer"
                    >
                      {isReaderExpanded ? (
                        <>
                          <Minimize2 className="w-3 h-3" />
                          <span>Свернуть область</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3" />
                          <span>Развернуть область просмотра</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isEditingContent ? (
                    <textarea
                      rows={isReaderExpanded ? 28 : 13}
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      className={`w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-slate-100 text-[13px] leading-relaxed focus:outline-none focus:border-amber-500 resize-y transition-all ${
                        isReaderExpanded ? 'min-h-[560px]' : 'min-h-[300px]'
                      }`}
                    />
                  ) : (
                    <div
                      className={`bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto transition-all ${
                        isReaderExpanded ? 'max-h-[72vh] min-h-[520px]' : 'max-h-[380px]'
                      }`}
                    >
                      <pre className="font-sans text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {selectedDoc.content}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    Автор / ответственный: <strong className="text-slate-200">{selectedDoc.authorName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={onOpenKnowledgeBase}
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
                  >
                    Перейти в «База знаний» →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Modal 1: Targeted Single-Document Export Confirmation */}
      {isExportModalOpen && exportTargetDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="targeted-export-title"
        >
          <form
            onSubmit={handleConfirmTargetedExport}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
                  <Download className="w-4 h-4" />
                  <span>Осознанный экспорт одного документа</span>
                </div>
                <h2 id="targeted-export-title" className="text-base font-bold text-white">
                  Подтверждение целевого документа и формата выгрузки
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Закрыть окно экспорта"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-300 font-semibold">
                Целевой документ для выгрузки (ровно 1 документ)
              </label>
              <select
                value={exportTargetDoc.id}
                onChange={(e) => setExportTargetDocId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {documents.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    [{doc.number}] {doc.title} — {doc.counterparty}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Номер и дата: </span>
                <span className="font-mono text-amber-400 font-semibold">
                  {exportTargetDoc.number}
                </span>{' '}
                <span className="text-slate-300">от {exportTargetDoc.createdAt}</span>
              </div>
              <div>
                <span className="text-slate-500">Вид / статус: </span>
                <span className="text-slate-200">
                  {KIND_LABELS[exportTargetDoc.kind]} · {STATUS_LABELS[exportTargetDoc.status]}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500">Контрагент: </span>
                <span className="text-slate-100 font-medium">{exportTargetDoc.counterparty}</span>
              </div>
            </div>

            {exportTargetDoc.kind !== 'template' && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">
                    Документ из изолированной конфиденциальной базы юриста
                  </div>
                  <p className="text-[11px] text-amber-200/85 mt-0.5">
                    Содержит сведения о контрагенте и финансовых условиях. Массовая выгрузка всей базы отключена — выгружается только выбранный файл.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="block text-slate-300 font-semibold">Формат файла</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(SINGLE_FORMAT_LABELS) as SingleDocExportFormat[]).map(fmt => {
                  const active = exportFormat === fmt;
                  return (
                    <label
                      key={fmt}
                      className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportFormat"
                        value={fmt}
                        checked={active}
                        onChange={() => setExportFormat(fmt)}
                        className="mt-0.5 accent-emerald-500"
                      />
                      <div>
                        <div className="font-semibold">{SINGLE_FORMAT_LABELS[fmt]}</div>
                        <div className="text-[11px] text-slate-400">{SINGLE_FORMAT_HINTS[fmt]}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportIncludeMetadata}
                  onChange={(e) => setExportIncludeMetadata(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Включить карточку реквизитов (номер, дата, филиал, контрагент, сумма)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportAnonymize}
                  onChange={(e) => setExportAnonymize(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Обезличить контрагента, ИНН, банковские счета, паспорта и контакты при выгрузке</span>
              </label>
            </div>

            {exportAnonymize && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-amber-300">
                  Предпросмотр обезличенного текста для экспорта:
                </div>
                <div className="max-h-32 overflow-y-auto p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <pre className="font-sans text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {anonymizeLegalText(exportTargetDoc.content, exportTargetDoc.counterparty)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Подтвердить и экспортировать ({SINGLE_FORMAT_LABELS[exportFormat]})</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Deliberate Transfer to Shared "База знаний" */}
      {isKbTransferModalOpen && kbTransferDoc && canEdit && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-transfer-title"
        >
          <form
            onSubmit={handleConfirmKbTransfer}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
                  <Database className="w-4 h-4" />
                  <span>Контроль передачи данных в «Базу знаний»</span>
                </div>
                <h2 id="kb-transfer-title" className="text-base font-bold text-white">
                  Осознанная публикация документа в «Базе знаний»
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsKbTransferModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Закрыть окно публикации"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-rose-300">
                  Разделение контуров безопасности
                </div>
                <p className="text-[11px] text-rose-200/85 mt-0.5">
                  «База знаний» открыта сотрудникам филиалов (руководителям парка, бухгалтерии, водителям) и используется как справочная база. Договоры с реквизитами, суммами и персональными данными должны оставаться в изолированной базе юриста или передаваться строго в обезличенном виде как образец.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-amber-400 font-bold">{kbTransferDoc.number}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">{KIND_LABELS[kbTransferDoc.kind]}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">{kbTransferDoc.counterparty}</span>
              </div>
              <div className="text-sm font-semibold text-white">{kbTransferDoc.title}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="block text-slate-300 font-semibold">Режим передачи</span>
                <label
                  className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    kbTransferMode === 'anonymized'
                      ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="kbTransferMode"
                    value="anonymized"
                    checked={kbTransferMode === 'anonymized'}
                    onChange={() => setKbTransferMode('anonymized')}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">Обезличить как образец (рекомендуется)</div>
                    <div className="text-[11px] text-slate-400">
                      Скрывает контрагента, ИНН, КПП, ОГРН, счета, паспорта, телефоны и email
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    kbTransferMode === 'full'
                      ? 'bg-amber-500/15 border-amber-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="kbTransferMode"
                    value="full"
                    checked={kbTransferMode === 'full'}
                    onChange={() => setKbTransferMode('full')}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div>
                    <div className="font-semibold">Полный текст без обезличивания</div>
                    <div className="text-[11px] text-slate-400">
                      Только для типовых шаблонов и документов без коммерческой тайны
                    </div>
                  </div>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">
                  Раздел в «Базе знаний»
                </label>
                <select
                  value={kbTransferCategory}
                  onChange={(e) =>
                    setKbTransferCategory(e.target.value as KnowledgeDoc['category'])
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="templates">Шаблоны договоров и претензий</option>
                  <option value="contracts">Договоры и образцы сделок</option>
                  <option value="disputes">Споры, претензии и кейсы</option>
                  <option value="regulations">Регламенты и положения</option>
                </select>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Оригинал с реальными реквизитами останется защищённым в изолированной базе юриста и не будет изменён.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-slate-300">
                  Предпросмотр текста, который попадёт в «Базу знаний»:
                </span>
                <span
                  className={
                    kbTransferMode === 'anonymized' ? 'text-emerald-400' : 'text-amber-400'
                  }
                >
                  {kbTransferMode === 'anonymized' ? 'Обезличено' : 'Полный текст'}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-950 border border-slate-800">
                <pre className="font-sans text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {kbTransferMode === 'anonymized'
                    ? anonymizeLegalText(kbTransferDoc.content, kbTransferDoc.counterparty)
                    : kbTransferDoc.content}
                </pre>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 cursor-pointer">
              <input
                type="checkbox"
                checked={kbTransferConfirmed}
                onChange={(e) => setKbTransferConfirmed(e.target.checked)}
                className="mt-0.5 accent-emerald-500"
              />
              <span>
                Подтверждаю, что содержание проверено на отсутствие несогласованной конфиденциальной информации и разрешено к размещению в общей «Базе знаний».
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsKbTransferModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!kbTransferConfirmed}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Подтвердить передачу в Базу знаний</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

