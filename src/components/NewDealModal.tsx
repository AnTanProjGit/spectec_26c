import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  UserCheck,
  GitBranch,
  MapPin,
  ChevronDown,
  History,
  Upload,
  Send,
  FileText,
  Trash2,
  MessageSquare
} from 'lucide-react';
import {
  AccountingSubjectId,
  ChatAttachment,
  ClientType,
  CRMDeal,
  DriverProfile,
  DriverReplacementRecord,
  DriverShiftRoster,
  Equipment,
  EquipmentType,
  FleetBranch,
  OneCIntegrationConfig,
  RentalOrder
} from '../types';
import { defaultOneCConfig, resolveAccountingSubject } from '../utils/accounting1c';
import { resolveDriverForEquipment, SHIFT_ROSTER_LABELS } from '../utils/driverAssignment';

interface NewDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  equipmentList: Equipment[];
  drivers?: DriverProfile[];
  replacements?: Record<string, DriverReplacementRecord>;
  deals?: CRMDeal[];
  orders?: RentalOrder[];
  branches?: FleetBranch[];
  activeBranch?: FleetBranch | null;
  oneCConfig?: OneCIntegrationConfig;
  onSubmitDeal: (deal: CRMDeal) => void;
  onSendAttachmentToChat?: (payload: {
    branchId: string;
    attachment: ChatAttachment;
    text: string;
    senderName: string;
  }) => void;
  onSendChatMessage?: (msg: {
    branchId: string;
    senderName: string;
    senderRole: 'admin' | 'fleet_manager' | 'driver' | 'client';
    text: string;
    attachment?: ChatAttachment;
  }) => void;
}

interface CustomerPreset {
  name: string;
  isRegular: boolean;
  contactPerson?: string;
  phone?: string;
  siteAddress?: string;
  equipmentType?: EquipmentType;
  hoursRequested?: number;
  hourlyRateAgreed?: number;
  manager?: string;
  clientType?: ClientType;
  hasContract?: boolean;
  accountingSubject?: AccountingSubjectId;
  sourceLabel?: string;
}

export const NewDealModal: React.FC<NewDealModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
  equipmentList,
  drivers = [],
  replacements = {},
  deals = [],
  orders = [],
  branches = [],
  activeBranch,
  oneCConfig = defaultOneCConfig,
  onSubmitDeal,
  onSendAttachmentToChat,
  onSendChatMessage
}) => {
  const [branchId, setBranchId] = useState<string>(activeBranch?.id || branches[0]?.id || 'branch-hq');
  const [clientType, setClientType] = useState<ClientType>('legal_entity');
  const [hasContract, setHasContract] = useState<boolean>(true);
  const [manualSubjectOverride, setManualSubjectOverride] = useState<AccountingSubjectId | ''>('');
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('+7 (9');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('excavator');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [preferredShiftRoster, setPreferredShiftRoster] = useState<DriverShiftRoster>('shift_1');
  const [hoursRequested, setHoursRequested] = useState(0);
  const [shiftsRequested, setShiftsRequested] = useState(0);
  const [hourlyRateAgreed, setHourlyRateAgreed] = useState(3300);
  const [siteAddress, setSiteAddress] = useState('');
  const [manager, setManager] = useState(activeBranch?.fleetManagerName || 'Орлов П. С.');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [autoFilledFrom, setAutoFilledFrom] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [dealAttachments, setDealAttachments] = useState<ChatAttachment[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [dealChatFeed, setDealChatFeed] = useState<
    { id: string; text: string; files: string[]; timestamp: string }[]
  >([]);
  const [sentToChatNotice, setSentToChatNotice] = useState(false);
  const [isEstimateHovered, setIsEstimateHovered] = useState(false);
  const [embeddedSavedNotice, setEmbeddedSavedNotice] = useState<string | null>(null);

  const clientFieldRef = useRef<HTMLDivElement>(null);
  const dealFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeBranch) {
      setBranchId(activeBranch.id);
      setManager(activeBranch.fleetManagerName);
    } else if (branches.length > 0) {
      setBranchId(branches[0].id);
      setManager(branches[0].fleetManagerName);
    }
    setIsClientDropdownOpen(false);
    setAutoFilledFrom(null);
    setSentToChatNotice(false);
    setHoursRequested(0);
    setShiftsRequested(0);
  }, [activeBranch, branches, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientFieldRef.current && !clientFieldRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const targetBranch = branches.find(b => b.id === branchId) || activeBranch || branches[0];
  const targetBranchId = targetBranch?.id || branchId;

  const customerPresets = useMemo<CustomerPreset[]>(() => {
    const map = new Map<string, CustomerPreset>();

    const normalize = (name: string) => name.trim().toLowerCase();

    // 1. Seed regular clients of the target branch first
    if (targetBranch) {
      targetBranch.regularClients.forEach((rc) => {
        const key = normalize(rc);
        if (!map.has(key)) {
          map.set(key, {
            name: rc,
            isRegular: true,
            clientType: 'legal_entity'
          });
        }
      });
    }

    // 2. Merge previous deals strictly within the target branch
    const branchDeals = deals
      .filter(d => d.branchId === targetBranchId)
      .sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));

    branchDeals.forEach((d) => {
      const key = normalize(d.clientName);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: d.clientName,
          isRegular: false,
          contactPerson: d.contactPerson,
          phone: d.phone,
          siteAddress: d.siteAddress,
          equipmentType: d.equipmentType,
          hoursRequested: d.hoursRequested,
          hourlyRateAgreed: d.hourlyRateAgreed,
          manager: d.manager,
          clientType: d.clientType || 'legal_entity',
          hasContract: d.hasContract,
          accountingSubject: d.accountingSubject,
          sourceLabel: `Сделка от ${d.dateCreated}`
        });
      } else {
        map.set(key, {
          ...existing,
          contactPerson: existing.contactPerson || d.contactPerson,
          phone: existing.phone || d.phone,
          siteAddress: existing.siteAddress || d.siteAddress,
          equipmentType: existing.equipmentType || d.equipmentType,
          hoursRequested: existing.hoursRequested ?? d.hoursRequested,
          hourlyRateAgreed: existing.hourlyRateAgreed ?? d.hourlyRateAgreed,
          manager: existing.manager || d.manager,
          clientType: existing.clientType || d.clientType,
          hasContract: existing.hasContract ?? d.hasContract,
          accountingSubject: existing.accountingSubject || d.accountingSubject,
          sourceLabel: existing.sourceLabel || `Сделка от ${d.dateCreated}`
        });
      }
    });

    // 3. Merge previous rental orders strictly within the target branch
    const branchOrders = orders
      .filter(o => o.branchId === targetBranchId)
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

    branchOrders.forEach((o) => {
      const eqType = equipmentList.find(e => e.id === o.equipmentId && e.branchId === targetBranchId)?.type;
      const key = normalize(o.clientName);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: o.clientName,
          isRegular: false,
          siteAddress: o.siteAddress,
          equipmentType: eqType,
          hoursRequested: o.plannedHours,
          hourlyRateAgreed: o.hourlyRate,
          clientType: o.clientType || 'legal_entity',
          hasContract: o.hasContract,
          accountingSubject: o.accountingSubject,
          sourceLabel: `Заказ ${o.orderNumber}`
        });
      } else {
        map.set(key, {
          ...existing,
          siteAddress: existing.siteAddress || o.siteAddress,
          equipmentType: existing.equipmentType || eqType,
          hoursRequested: existing.hoursRequested ?? o.plannedHours,
          hourlyRateAgreed: existing.hourlyRateAgreed ?? o.hourlyRate,
          clientType: existing.clientType || o.clientType,
          hasContract: existing.hasContract ?? o.hasContract,
          accountingSubject: existing.accountingSubject || o.accountingSubject,
          sourceLabel: existing.sourceLabel || `Заказ ${o.orderNumber}`
        });
      }
    });

    return Array.from(map.values());
  }, [targetBranch, targetBranchId, deals, orders, equipmentList]);

  const filteredCustomerPresets = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    const byType = customerPresets.filter(c =>
      clientType === 'legal_entity'
        ? (c.clientType || 'legal_entity') === 'legal_entity'
        : c.clientType === 'individual'
    );
    const baseList = byType.length > 0 ? byType : customerPresets;
    if (!q) return baseList;
    const filtered = baseList.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.siteAddress && c.siteAddress.toLowerCase().includes(q))
    );
    return filtered.length > 0 ? filtered : baseList;
  }, [customerPresets, clientName, clientType]);

  if (!embedded && !isOpen) return null;

  const applyCustomerPreset = (preset: CustomerPreset) => {
    setClientName(preset.name);
    if (preset.contactPerson) setContactPerson(preset.contactPerson);
    if (preset.phone) setPhone(preset.phone);
    if (preset.siteAddress) setSiteAddress(preset.siteAddress);
    if (preset.equipmentType) setEquipmentType(preset.equipmentType);
    if (preset.hourlyRateAgreed !== undefined) setHourlyRateAgreed(preset.hourlyRateAgreed);
    if (preset.manager) setManager(preset.manager);
    if (preset.clientType) setClientType(preset.clientType);
    if (preset.hasContract !== undefined) setHasContract(preset.hasContract);
    if (preset.accountingSubject) setManualSubjectOverride(preset.accountingSubject);
    setAutoFilledFrom(preset.sourceLabel || (preset.contactPerson || preset.siteAddress ? 'История заказов' : null));
    setIsClientDropdownOpen(false);
  };

  const effectiveHasContract =
    clientType === 'legal_entity' && oneCConfig.routing.requireContractForLegalEntity
      ? true
      : hasContract;

  const autoResolution = resolveAccountingSubject(
    clientType,
    effectiveHasContract,
    oneCConfig.routing
  );

  const selectedSubjectId: AccountingSubjectId =
    manualSubjectOverride || autoResolution.subjectId;
  const selectedSubject = oneCConfig.subjects[selectedSubjectId];

  const estimatedAmount = hoursRequested * hourlyRateAgreed;

  // Availability & driver resolution check within target branch
  const branchTypeMachines = equipmentList.filter(
    e => e.branchId === targetBranchId && e.type === equipmentType
  );
  const availableMachines = branchTypeMachines.filter(
    e => e.status === 'available' || e.status === 'reserve'
  );
  const resolvedSelectedEquipment =
    branchTypeMachines.find(e => e.id === selectedEquipmentId) ||
    availableMachines[0] ||
    branchTypeMachines[0];
  const driverResolution = resolveDriverForEquipment(
    resolvedSelectedEquipment,
    drivers,
    replacements,
    preferredShiftRoster
  );

  const handleDealFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, idx) => {
      const isImage = file.type.startsWith('image/');
      const category: ChatAttachment['category'] = isImage ? 'site_photo' : 'other';
      const reader = new FileReader();
      reader.onload = () => {
        const nextAtt: ChatAttachment = {
          id: `att-${Date.now()}-${idx}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'text/plain',
          category,
          previewUrl: typeof reader.result === 'string' ? reader.result : undefined
        };
        setAttachments(prev => [...prev, nextAtt]);
        setDealAttachments(prev => [...prev, nextAtt]);
        setSentToChatNotice(false);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const handleSendToDealChat = () => {
    const trimmed = chatMessage.trim();
    if (!trimmed && attachments.length === 0) return;

    const resolvedBranchId = targetBranch?.id || branchId || 'branch-hq';
    const senderName = `${manager} (CRM Заявка)`;
    const contextPrefix = `${clientName ? `${clientName}` : 'Новая заявка'}${
      siteAddress ? ` · ${siteAddress}` : ''
    }`;

    if (attachments.length > 0) {
      attachments.forEach((att, idx) => {
        const msgText =
          idx === 0 && trimmed
            ? `${contextPrefix}: ${trimmed}`
            : `${contextPrefix}: прикреплён файл «${att.name}».`;

        if (onSendAttachmentToChat) {
          onSendAttachmentToChat({
            branchId: resolvedBranchId,
            attachment: att,
            text: msgText,
            senderName
          });
        } else if (onSendChatMessage) {
          onSendChatMessage({
            branchId: resolvedBranchId,
            senderName,
            senderRole: 'fleet_manager',
            text: msgText,
            attachment: att
          });
        }
      });
    } else if (trimmed && onSendChatMessage) {
      onSendChatMessage({
        branchId: resolvedBranchId,
        senderName,
        senderRole: 'fleet_manager',
        text: `${contextPrefix}: ${trimmed}`
      });
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setDealChatFeed(prev => [
      ...prev,
      {
        id: `dchat-${Date.now()}`,
        text: trimmed || (attachments.length > 0 ? 'Отправлен файл по заявке' : ''),
        files: attachments.map(a => a.name),
        timestamp: `${hh}:${mm}`
      }
    ]);

    setChatMessage('');
    setAttachments([]);
    setSentToChatNotice(true);
    setTimeout(() => setSentToChatNotice(false), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !siteAddress) return;

    const trimmedMsg = chatMessage.trim();
    if (trimmedMsg && onSendChatMessage) {
      onSendChatMessage({
        branchId: targetBranch?.id || branchId || 'branch-hq',
        senderName: `${manager} (CRM Заявка)`,
        senderRole: 'fleet_manager',
        text: `${clientName} · ${siteAddress}: ${trimmedMsg}`
      });
    }

    const combinedAttachments = dealAttachments.length > 0 ? dealAttachments : attachments;

    const newDeal: CRMDeal = {
      id: `deal-${Date.now().toString().slice(-4)}`,
      branchId: targetBranch?.id || branchId || 'branch-hq',
      clientName,
      contactPerson,
      phone,
      clientType,
      hasContract: effectiveHasContract,
      accountingSubject: selectedSubjectId,
      equipmentType,
      equipmentAssignedId: resolvedSelectedEquipment?.id,
      assignedDriverId:
        driverResolution.replacementRecord?.driverId ||
        driverResolution.resolvedDriver?.id,
      assignedDriverName:
        driverResolution.replacementRecord?.driverName ||
        driverResolution.resolvedDriver?.name ||
        resolvedSelectedEquipment?.assignedOperator ||
        undefined,
      assignedDriverPhone:
        driverResolution.replacementRecord?.driverPhone ||
        driverResolution.resolvedDriver?.phone ||
        undefined,
      driverAssignmentMode:
        driverResolution.mode === 'unassigned' ? undefined : driverResolution.mode,
      hoursRequested,
      shiftsRequested,
      hourlyRateAgreed,
      estimatedAmount,
      stage: 'lead',
      debtAmount: 0,
      siteAddress,
      dateCreated: new Date().toISOString().split('T')[0],
      manager,
      attachments: combinedAttachments.length > 0 ? combinedAttachments : undefined
    };

    onSubmitDeal(newDeal);
    setAttachments([]);
    setDealAttachments([]);
    setChatMessage('');
    setDealChatFeed([]);
    setHoursRequested(0);
    setShiftsRequested(0);
    if (embedded) {
      setEmbeddedSavedNotice(`Заявка для «${clientName}» зарегистрирована в CRM (${targetBranch?.documentFlow.orderPrefix || ''})`);
      setClientName('');
      setContactPerson('');
      setPhone('+7 (9');
      setSiteAddress('');
      setTimeout(() => setEmbeddedSavedNotice(null), 4000);
    } else {
      onClose();
    }
  };

  const formCard = (
    <div
      className={
        embedded
          ? 'bg-slate-900 border border-slate-800 rounded-xl w-full overflow-hidden'
          : 'bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl'
      }
    >
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-800 ${
          embedded ? 'bg-slate-950/60' : 'sticky top-0 bg-slate-900/95 backdrop-blur z-10'
        }`}
      >
        <div>
          <h3 className="text-base font-bold text-white">Регистрация заявки на аренду (CRM)</h3>
          <p className="text-[13px] text-slate-400">
            Выбор контрагента (ЮЛ / ФЛ), типа оформления и маршрутизация в 1С
          </p>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {embeddedSavedNotice && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{embeddedSavedNotice}</span>
        </div>
      )}

        <form onSubmit={handleSubmit} className="p-4 space-y-2 text-xs">
          {/* Branch / Fleet Manager routing selector (compact) */}
          {branches.length > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Участок / поток:</span>
                {targetBranch && (
                  <span className="font-mono text-amber-300 font-semibold">
                    {targetBranch.documentFlow.orderPrefix} · {targetBranch.documentFlow.oneCDepartmentCode}
                  </span>
                )}
              </div>
              {activeBranch ? (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[11px] font-semibold">
                  {activeBranch.code} · {activeBranch.fleetManagerName}
                </span>
              ) : (
                <select
                  value={branchId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setBranchId(nextId);
                    const b = branches.find(item => item.id === nextId);
                    if (b) setManager(b.fleetManagerName);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      [{b.code}] {b.name} — {b.fleetManagerName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Client type & Contract routing selector */}
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/80 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Тип заказчика</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setClientType('legal_entity');
                      setManualSubjectOverride('');
                      if (oneCConfig.routing.requireContractForLegalEntity) {
                        setHasContract(true);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium transition cursor-pointer ${
                      clientType === 'legal_entity'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Юр. лицо</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientType('individual');
                      setManualSubjectOverride('');
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium transition cursor-pointer ${
                      clientType === 'individual'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Физ. лицо</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Основание работы</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHasContract(true);
                      setManualSubjectOverride('');
                    }}
                    className={`px-2.5 py-2 rounded-lg border font-medium transition cursor-pointer ${
                      effectiveHasContract
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    По договору
                  </button>
                  <button
                    type="button"
                    disabled={
                      (clientType === 'legal_entity' && oneCConfig.routing.requireContractForLegalEntity) ||
                      (clientType === 'individual' && !oneCConfig.routing.allowIndividualWithoutContract)
                    }
                    onClick={() => {
                      setHasContract(false);
                      setManualSubjectOverride('');
                    }}
                    className={`px-2.5 py-2 rounded-lg border font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      !effectiveHasContract
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Без договора
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60">
              <div className="flex items-center gap-1.5 text-[13px] text-slate-300">
                <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Маршрутизация 1С:{' '}
                  <strong className="text-amber-300">{selectedSubject.entityName}</strong>{' '}
                  <span className="text-slate-400">({selectedSubject.taxSystem})</span>
                </span>
              </div>

              <select
                value={manualSubjectOverride || autoResolution.subjectId}
                onChange={(e) => setManualSubjectOverride(e.target.value as AccountingSubjectId)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[13px] text-slate-200 focus:outline-none focus:border-amber-500"
                title="Можно скорректировать субъект бухгалтерии 1С"
              >
                <option value="ooo_specialtech">ООО «SpecialTech»</option>
                <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
              </select>
            </div>
          </div>

          <div ref={clientFieldRef} className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block font-medium text-slate-300">
                {clientType === 'legal_entity'
                  ? 'Компания / Заказчик (Юр. лицо)'
                  : 'ФИО частного заказчика (Физ. лицо)'}
              </label>
              {autoFilledFrom && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <History className="w-3 h-3" />
                  <span>Реквизиты заполнены ({autoFilledFrom})</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder={
                  clientType === 'legal_entity'
                    ? 'Введите или выберите из списка: ООО «Монолит-Строй»...'
                    : 'Например: Смирнов Алексей Викторович'
                }
                value={clientName}
                onFocus={() => setIsClientDropdownOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setClientName(val);
                  setAutoFilledFrom(null);
                  setIsClientDropdownOpen(true);

                  const exactMatch = customerPresets.find(
                    c => c.name.trim().toLowerCase() === val.trim().toLowerCase()
                  );
                  if (exactMatch) {
                    applyCustomerPreset(exactMatch);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-9 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
              {customerPresets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClientDropdownOpen(prev => !prev)}
                  title="Регулярные заказчики участка"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-700/60 transition cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isClientDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Dropdown suggestion list */}
            {isClientDropdownOpen && filteredCustomerPresets.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 z-30 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">
                    Регулярные заказчики участка:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Выбор заполнит реквизиты
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/70">
                  {filteredCustomerPresets.map((preset, idx) => {
                    const hasRequisites = Boolean(preset.contactPerson || preset.phone || preset.siteAddress);
                    return (
                      <button
                        key={`${preset.name}-${idx}`}
                        type="button"
                        onClick={() => applyCustomerPreset(preset)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800/80 transition cursor-pointer flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-white truncate">
                              {preset.name}
                            </span>
                            {preset.isRegular && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono shrink-0">
                                Регулярный
                              </span>
                            )}
                          </div>
                          {hasRequisites && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {[preset.contactPerson, preset.phone, preset.siteAddress]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        {preset.hourlyRateAgreed && (
                          <span className="text-xs font-mono text-emerald-400 shrink-0 mt-0.5">
                            {preset.hourlyRateAgreed.toLocaleString()} ₽/ч
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Контактное лицо</label>
              <input
                type="text"
                placeholder="Иванов Сергей"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Телефон для связи</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Тип запрашиваемой техники</label>
              <select
                value={equipmentType}
                onChange={(e) => {
                  const type = e.target.value as EquipmentType;
                  setEquipmentType(type);
                  if (type === 'crane') setHourlyRateAgreed(4800);
                  else if (type === 'excavator') setHourlyRateAgreed(3400);
                  else if (type === 'dump_truck') setHourlyRateAgreed(2500);
                  else setHourlyRateAgreed(2700);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="excavator">Экскаватор гусеничный/колёсный</option>
                <option value="crane">Автокран (25т - 50т)</option>
                <option value="dump_truck">Самосвал (20 - 26 м³)</option>
                <option value="loader">Фронтальный погрузчик</option>
                <option value="bulldozer">Бульдозер</option>
                <option value="cherry_picker">Автовышка</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Ответственный Fleet Manager</label>
              <select
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {Array.from(
                  new Set([
                    ...(targetBranch ? [targetBranch.fleetManagerName] : []),
                    ...branches.map(b => b.fleetManagerName),
                    'Орлов П. С.',
                    'Волков И. А.',
                    'Елисеев Д. М.',
                    'Смирнова А. В.'
                  ])
                ).map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability & unit selector (compact) */}
          <div className="px-2.5 py-1.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Техника:</span>
                {availableMachines.length > 0 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Свободно {availableMachines.length} ед.
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Занята ({branchTypeMachines.length} ед. в парке)
                  </span>
                )}
              </div>

              {branchTypeMachines.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={resolvedSelectedEquipment?.id || ''}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    aria-label="Единица техники для заказа в CRM"
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-100 font-mono focus:outline-none focus:border-amber-500 max-w-[230px]"
                  >
                    {branchTypeMachines.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        [{eq.inventoryNumber}] {eq.name} ({eq.status === 'available' ? 'Свободна' : 'В работе'})
                      </option>
                    ))}
                  </select>

                  {driverResolution.mode === 'timesheet_shift' && (
                    <select
                      value={preferredShiftRoster}
                      onChange={(e) => setPreferredShiftRoster(e.target.value as DriverShiftRoster)}
                      aria-label="Смена по табелю"
                      className="bg-slate-900 border border-sky-500/40 rounded px-2 py-0.5 text-[11px] text-sky-200 focus:outline-none focus:border-sky-400"
                    >
                      <option value="shift_1">{SHIFT_ROSTER_LABELS.shift_1}</option>
                      <option value="shift_2">{SHIFT_ROSTER_LABELS.shift_2}</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Запрашиваемые моточасы</label>
              <input
                type="number"
                min={0}
                value={hoursRequested}
                onChange={(e) => setHoursRequested(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Запрашиваемые смены</label>
              <input
                type="number"
                min={0}
                value={shiftsRequested}
                onChange={(e) => setShiftsRequested(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Ставка (₽/час)</label>
              <input
                type="number"
                min={0}
                value={hourlyRateAgreed}
                onChange={(e) => setHourlyRateAgreed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Адрес строительной площадки</label>
            <input
              type="text"
              placeholder="г. Москва, ш. Энтузиастов, д. 5"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {/* Deal Chat & File Upload (text files or photos) */}
          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold text-slate-200 text-xs">
                  Чат для заявки
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Сообщения, текстовые файлы и фото
              </span>
            </div>

            {dealChatFeed.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-slate-900/90 border border-slate-800/80">
                {dealChatFeed.map(entry => (
                  <div key={entry.id} className="text-xs text-slate-200 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-amber-300">
                        {manager}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {entry.timestamp}
                      </span>
                    </div>
                    {entry.text && <p className="text-slate-200 leading-snug">{entry.text}</p>}
                    {entry.files.length > 0 && (
                      <p className="text-[11px] font-mono text-sky-300">
                        Файлы: {entry.files.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <textarea
              rows={2}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendToDealChat();
                }
              }}
              placeholder="Напишите сообщение по заявке или прикрепите текстовый файл / фото..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  ref={dealFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,text/*,.txt,.pdf,.doc,.docx,.xls,.xlsx,.rtf,.csv,.md,.log"
                  onChange={handleDealFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => dealFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Подгрузить файл</span>
                </button>
              </div>

              <button
                type="button"
                disabled={!chatMessage.trim() && attachments.length === 0}
                onClick={handleSendToDealChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправить в чат</span>
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {att.previewUrl && att.mimeType.startsWith('image/') ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-7 h-7 rounded object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-xs text-slate-200 truncate">{att.name}</span>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {formatFileSize(att.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachments(prev => prev.filter(item => item.id !== att.id));
                        setDealAttachments(prev => prev.filter(item => item.id !== att.id));
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sentToChatNotice && (
              <p className="text-[11px] text-emerald-400 font-medium">
                ✓ Сообщение / файл(ы) отправлены в операционный чат участка.
              </p>
            )}
          </div>

          {/* Collapsible Estimated Amount — collapsed by default, expands on hover */}
          <div
            onMouseEnter={() => setIsEstimateHovered(true)}
            onMouseLeave={() => setIsEstimateHovered(false)}
            className="group px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800 hover:border-amber-500/40 transition-all duration-200 cursor-default"
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium text-xs">Сметная сумма</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-amber-400 transition-colors">
                <span>{isEstimateHovered ? 'Расчёт сметы' : 'Наведите для просмотра'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isEstimateHovered ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </span>
            </div>

            <div
              className={`overflow-hidden transition-all duration-200 ${
                isEstimateHovered ? 'max-h-20 opacity-100 mt-2 pt-2 border-t border-slate-800' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  {hoursRequested} м/ч{shiftsRequested > 0 ? ` · ${shiftsRequested} см.` : ''} × {hourlyRateAgreed.toLocaleString()} ₽/ч
                </span>
                <span className="text-lg font-bold text-amber-400 num-mono">
                  {estimatedAmount.toLocaleString()} ₽
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            {!embedded && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer font-medium"
              >
                Отмена
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              Создать заявку
            </button>
          </div>
        </form>
      </div>
  );

  if (embedded) return formCard;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      {formCard}
    </div>
  );
};
