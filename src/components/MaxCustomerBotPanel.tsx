import React, { useState, useMemo } from 'react';
import {
  Send,
  MapPin,
  FileText,
  Truck,
  CheckCircle2,
  MessageSquare,
  Sliders,
  Phone,
  Building2,
  UserCheck,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  CRMDeal,
  ClientType,
  Equipment,
  EquipmentType,
  FleetBranch,
  MaxCustomerBotConfig,
  OneCIntegrationConfig,
  ShiftReport
} from '../types';
import { resolveAccountingSubject } from '../utils/accounting1c';

interface MaxCustomerBotPanelProps {
  branch: FleetBranch;
  botConfig: MaxCustomerBotConfig;
  onUpdateBotConfig: (next: MaxCustomerBotConfig) => void;
  equipmentList: Equipment[];
  deals: CRMDeal[];
  shiftReports: ShiftReport[];
  oneCConfig: OneCIntegrationConfig;
  onSubmitDealFromBot: (deal: CRMDeal) => void;
  onSendChatMessage: (payload: {
    branchId: string;
    senderName: string;
    senderRole: 'client' | 'fleet_manager';
    text: string;
  }) => void;
}

interface BotChatEntry {
  id: string;
  author: 'bot' | 'client';
  time: string;
  title?: string;
  text: string;
  meta?: string;
}

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  excavator: 'Экскаватор',
  crane: 'Автокран',
  dump_truck: 'Самосвал',
  loader: 'Фронтальный погрузчик',
  bulldozer: 'Бульдозер',
  cherry_picker: 'Автовышка'
};

const DEFAULT_RATES: Record<EquipmentType, number> = {
  excavator: 3400,
  crane: 4800,
  dump_truck: 2500,
  loader: 2700,
  bulldozer: 3200,
  cherry_picker: 2600
};

export const MaxCustomerBotPanel: React.FC<MaxCustomerBotPanelProps> = ({
  branch,
  botConfig,
  onUpdateBotConfig,
  equipmentList,
  deals,
  shiftReports,
  oneCConfig,
  onSubmitDealFromBot,
  onSendChatMessage
}) => {
  const defaultClientName = branch.regularClients[0] || 'ООО «Монолит-Строй»';
  const [activeClientName, setActiveClientName] = useState<string>(defaultClientName);
  const [clientContactName, setClientContactName] = useState<string>('Захаров Р. О.');
  const [clientMaxPhone, setClientMaxPhone] = useState<string>('+7 (916) 440-18-92');
  const [clientType, setClientType] = useState<ClientType>('legal_entity');
  const [hasContract, setHasContract] = useState<boolean>(true);

  const [botScreen, setBotScreen] = useState<'new_request' | 'shifts' | 'message'>('new_request');

  // New request form fields inside MAX bot (derived from Fleet Manager CRM form)
  const [reqEquipmentType, setReqEquipmentType] = useState<EquipmentType>('excavator');
  const [reqHours, setReqHours] = useState<number>(40);
  const [reqSiteAddress, setReqSiteAddress] = useState<string>('');
  const [reqComment, setReqComment] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');

  const [botFeed, setBotFeed] = useState<BotChatEntry[]>([
    {
      id: 'init-1',
      author: 'bot',
      time: '09:00',
      title: `Бот заказчика MAX · ${branch.name}`,
      text: `Вы подключены к участку [${branch.code}] ${branch.name}. Все заявки и акты автоматически направляются в поток ${branch.documentFlow.orderPrefix} (ответственный Fleet Manager: ${branch.fleetManagerName}).`
    }
  ]);

  const branchMachines = useMemo(
    () => equipmentList.filter(e => e.branchId === branch.id),
    [equipmentList, branch.id]
  );

  const branchDeals = useMemo(
    () => deals.filter(d => d.branchId === branch.id),
    [deals, branch.id]
  );

  const branchShifts = useMemo(
    () => shiftReports.filter(s => s.branchId === branch.id).slice(0, 5),
    [shiftReports, branch.id]
  );

  const formatTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const resolved1C = resolveAccountingSubject(
    clientType,
    clientType === 'legal_entity' && oneCConfig.routing.requireContractForLegalEntity
      ? true
      : hasContract,
    oneCConfig.routing
  );

  const availableOfType = branchMachines.filter(
    e => e.type === reqEquipmentType && (e.status === 'available' || e.status === 'reserve')
  );
  const firstMachineOfType =
    availableOfType[0] || branchMachines.find(e => e.type === reqEquipmentType);

  const handleSubmitBotRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botConfig.enabled || !botConfig.allowNewRentalRequests) return;
    if (!activeClientName.trim() || !reqSiteAddress.trim()) return;

    const rate = DEFAULT_RATES[reqEquipmentType] || 3000;
    const estAmount = reqHours * rate;
    const routingNumber = `${branch.documentFlow.orderPrefix}MAX-${Math.floor(100 + Math.random() * 899)}`;

    const newDeal: CRMDeal = {
      id: `deal-max-${Date.now().toString().slice(-4)}`,
      branchId: branch.id,
      clientName: activeClientName.trim(),
      contactPerson: `${clientContactName.trim() || 'Представитель'} (MAX)`,
      phone: clientMaxPhone.trim(),
      clientType,
      hasContract:
        clientType === 'legal_entity' && oneCConfig.routing.requireContractForLegalEntity
          ? true
          : hasContract,
      accountingSubject: botConfig.autoRouteTo1C
        ? resolved1C.subjectId
        : branch.documentFlow.default1CSubject,
      equipmentType: reqEquipmentType,
      equipmentAssignedId: firstMachineOfType?.id,
      hoursRequested: reqHours,
      hourlyRateAgreed: rate,
      estimatedAmount: estAmount,
      stage: 'lead',
      debtAmount: 0,
      siteAddress: reqSiteAddress.trim(),
      dateCreated: new Date().toISOString().split('T')[0],
      manager: branch.fleetManagerName
    };

    onSubmitDealFromBot(newDeal);

    onSendChatMessage({
      branchId: branch.id,
      senderName: `${activeClientName} (Бот MAX)`,
      senderRole: 'client',
      text: `[Заявка MAX ${routingNumber}] Нужен ${EQUIPMENT_LABELS[reqEquipmentType]} на ${reqHours} м/ч по адресу: ${reqSiteAddress.trim()}.${reqComment.trim() ? ` Комментарий: ${reqComment.trim()}` : ''}`
    });

    const t = formatTime();
    setBotFeed(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: 'client',
        time: t,
        text: `Заявка: ${EQUIPMENT_LABELS[reqEquipmentType]} · ${reqHours} ч · ${reqSiteAddress.trim()}`
      },
      {
        id: `b-${Date.now() + 1}`,
        author: 'bot',
        time: t,
        title: `Заявка ${routingNumber} зарегистрирована`,
        text: `Передано в CRM участка [${branch.code}] ${branch.name} менеджеру ${branch.fleetManagerName}. Подразделение 1С: ${branch.documentFlow.oneCDepartmentCode} (${oneCConfig.subjects[newDeal.accountingSubject || 'ooo_specialtech'].shortName}). Статус: ${
          botConfig.requireManagerModeration ? 'На модерации у Fleet Manager' : 'Принято в расчёт'
        }.`
      }
    ]);

    setReqSiteAddress('');
    setReqComment('');
  };

  const handleConfirmShiftInBot = (shift: ShiftReport, action: 'confirm' | 'question') => {
    if (!botConfig.enabled || !botConfig.allowShiftHourConfirmation) return;
    const t = formatTime();
    const eq = equipmentList.find(item => item.id === shift.equipmentId);
    const waybillLabel = shift.waybillNumber || shift.shiftNumber;

    const clientText =
      action === 'confirm'
        ? `Подтверждаю смену ${waybillLabel} (${shift.date}): ${shift.workHours} ч работы на объекте «${shift.siteName}».`
        : `Прошу уточнить часы по путевому листу ${waybillLabel} (${shift.date}) по объекту «${shift.siteName}».`;

    onSendChatMessage({
      branchId: branch.id,
      senderName: `${activeClientName} (MAX)`,
      senderRole: 'client',
      text: clientText
    });

    setBotFeed(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: 'client',
        time: t,
        text: clientText
      },
      {
        id: `b-${Date.now() + 1}`,
        author: 'bot',
        time: t,
        title: action === 'confirm' ? 'Подтверждение зафиксировано' : 'Запрос передан диспетчеру',
        text: `Отметка по ${eq ? `[${eq.inventoryNumber}] ${eq.name}` : 'технике'} направлена Fleet Manager (${branch.fleetManagerName}) в контур ${branch.documentFlow.waybillPrefix}.`
      }
    ]);
  };

  const handleSendDirectMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botConfig.enabled || !botConfig.allowSiteChatAndPhotos || !customMessage.trim()) return;
    const text = customMessage.trim();
    const t = formatTime();

    onSendChatMessage({
      branchId: branch.id,
      senderName: `${activeClientName} (MAX)`,
      senderRole: 'client',
      text
    });

    setBotFeed(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: 'client',
        time: t,
        text
      },
      {
        id: `b-${Date.now() + 1}`,
        author: 'bot',
        time: t,
        text: `Сообщение доставлено Fleet Manager участка [${branch.code}] (${branch.fleetManagerName}).`
      }
    ]);
    setCustomMessage('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left column: Fleet Manager moderation & branch routing settings for Customer MAX Bot */}
      <div className="lg:col-span-5 space-y-3">
        {/* Branch routing membership card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                Принадлежность к участку (маршрутизация MAX)
              </h3>
            </div>
            <span className="font-mono text-xs text-amber-300 font-bold">
              {branch.code}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Участок / филиал:</span>
              <span className="text-slate-100 font-semibold">{branch.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ответственный Fleet Manager:</span>
              <span className="text-slate-100 font-medium">{branch.fleetManagerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Поток документов (CRM / ЭСМ-7):</span>
              <span className="font-mono text-emerald-400 tabular-nums">
                {branch.documentFlow.orderPrefix} · {branch.documentFlow.waybillPrefix}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Подразделение 1С:</span>
              <span className="font-mono text-sky-300 tabular-nums">
                {branch.documentFlow.oneCDepartmentCode}
              </span>
            </div>
          </div>
        </div>

        {/* Bot access & moderation settings */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">
                Настройки Бота заказчика «MAX»
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onUpdateBotConfig({ ...botConfig, enabled: !botConfig.enabled })}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                botConfig.enabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
              }`}
            >
              {botConfig.enabled ? 'Бот включён' : 'Бот отключён'}
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {[
              {
                key: 'allowNewRentalRequests' as const,
                label: 'Приём заявок на технику (CRM) через MAX'
              },
              {
                key: 'allowShiftHourConfirmation' as const,
                label: 'Подтверждение смен и путевых листов заказчиком'
              },
              {
                key: 'allowSiteChatAndPhotos' as const,
                label: 'Прямые сообщения заказчика в корпоративный чат'
              },
              {
                key: 'autoRouteTo1C' as const,
                label: 'Автомаршрутизация в 1С (ООО / ИП) по правилам участка'
              },
              {
                key: 'requireManagerModeration' as const,
                label: 'Обязательная модерация MAX-заявок Fleet Manager'
              }
            ].map(item => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700"
              >
                <span className="text-slate-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={botConfig[item.key]}
                  onChange={(e) =>
                    onUpdateBotConfig({
                      ...botConfig,
                      [item.key]: e.target.checked
                    })
                  }
                  className="rounded border-slate-600 bg-slate-800 text-amber-500"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Customer profile selector for testing/previewing the MAX Bot */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Профиль заказчика в сеансе MAX</h3>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Заказчик / Организация</label>
            <input
              type="text"
              list={`clients-${branch.id}`}
              value={activeClientName}
              onChange={(e) => setActiveClientName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <datalist id={`clients-${branch.id}`}>
              {branch.regularClients.map(rc => (
                <option key={rc} value={rc} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">Представитель (прораб)</label>
              <input
                type="text"
                value={clientContactName}
                onChange={(e) => setClientContactName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-slate-400 mb-1">
                <Phone className="w-3 h-3 text-sky-400" />
                <span>Телефон MAX</span>
              </label>
              <input
                type="text"
                value={clientMaxPhone}
                onChange={(e) => setClientMaxPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setClientType('legal_entity')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border font-medium cursor-pointer ${
                clientType === 'legal_entity'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Юр. лицо</span>
            </button>
            <button
              type="button"
              onClick={() => setClientType('individual')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border font-medium cursor-pointer ${
                clientType === 'individual'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Физ. лицо</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right column: Interactive MAX Customer Bot Simulator */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {/* MAX Bot Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono text-xs font-bold">
                MAX
              </span>
              <h3 className="text-sm font-bold text-white">
                @SpecialTech_Client_Bot — Бот заказчика
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Участок: [{branch.code}] {branch.name} · Fleet Manager: {branch.fleetManagerName} · Поток: {branch.documentFlow.orderPrefix}
            </p>
          </div>

          <div className="text-right text-xs font-mono text-slate-400 tabular-nums">
            <span>Заявок участка: {branchDeals.length}</span>
          </div>
        </div>

        {!botConfig.enabled ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-semibold text-white">
              Бот заказчика «MAX» для участка {branch.name} временно приостановлен
            </p>
            <p className="text-xs text-slate-400">
              Включите доступ в панели настроек слева, чтобы принимать заявки и подтверждения от заказчиков.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Chat Dialog Log */}
            <div className="p-3.5 space-y-2.5 max-h-[260px] overflow-y-auto bg-slate-950/60 border-b border-slate-800">
              {botFeed.map(entry => (
                <div
                  key={entry.id}
                  className={`flex ${entry.author === 'client' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs space-y-1 border ${
                      entry.author === 'client'
                        ? 'bg-sky-500/15 border-sky-500/30 text-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    {entry.title && (
                      <div className="font-bold text-amber-300">{entry.title}</div>
                    )}
                    <p className="leading-relaxed">{entry.text}</p>
                    <div className="text-[11px] font-mono text-slate-500 text-right tabular-nums">
                      {entry.author === 'client' ? activeClientName : 'Бот MAX'} · {entry.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bot Menu Tabs */}
            <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setBotScreen('new_request')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  botScreen === 'new_request'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Заказать технику (CRM)</span>
              </button>
              <button
                type="button"
                onClick={() => setBotScreen('shifts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  botScreen === 'shifts'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Смены и путевые ({branchShifts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setBotScreen('message')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  botScreen === 'message'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Чат с Fleet Manager</span>
              </button>
            </div>

            {/* Interactive Bot Screen */}
            <div className="p-4 text-xs">
              {botScreen === 'new_request' && (
                botConfig.allowNewRentalRequests ? (
                  <form onSubmit={handleSubmitBotRequest} className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                      <span>
                        Форма MAX для <strong className="text-white">{activeClientName}</strong>
                      </span>
                      <span className="font-mono text-amber-300">
                        Маршрут: {branch.documentFlow.orderPrefix} · {branch.documentFlow.oneCDepartmentCode}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-slate-300 font-medium mb-1">Тип спецтехники</label>
                        <select
                          value={reqEquipmentType}
                          onChange={(e) => setReqEquipmentType(e.target.value as EquipmentType)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                        >
                          {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v} ({DEFAULT_RATES[k as EquipmentType].toLocaleString()} ₽/ч)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Объём (часов)</label>
                        <input
                          type="number"
                          min={8}
                          step={8}
                          value={reqHours}
                          onChange={(e) => setReqHours(Math.max(1, parseInt(e.target.value, 10) || 8))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Адрес объекта</label>
                        <input
                          type="text"
                          placeholder="г. Москва, ул. Промышленная, 12"
                          value={reqSiteAddress}
                          onChange={(e) => setReqSiteAddress(e.target.value)}
                          required
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Комментарий / вид работ</label>
                        <input
                          type="text"
                          placeholder="Разработка котлована, нужен пропуск"
                          value={reqComment}
                          onChange={(e) => setReqComment(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasContract}
                          onChange={(e) => setHasContract(e.target.checked)}
                          disabled={clientType === 'legal_entity' && oneCConfig.routing.requireContractForLegalEntity}
                          className="rounded border-slate-600 bg-slate-800 text-amber-500"
                        />
                        <span>Работа по договору · 1С: {oneCConfig.subjects[resolved1C.subjectId].shortName}</span>
                      </label>

                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Отправить заявку через MAX</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-center">
                    Приём новых заявок через Бот заказчика MAX отключён настройками Fleet Manager.
                  </div>
                )
              )}

              {botScreen === 'shifts' && (
                <div className="space-y-2">
                  {!botConfig.allowShiftHourConfirmation ? (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-center">
                      Согласование смен в Боте заказчика MAX отключено Fleet Manager.
                    </div>
                  ) : branchShifts.length === 0 ? (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-center">
                      По участку [{branch.code}] пока нет сформированных смен.
                    </div>
                  ) : (
                    branchShifts.map(shift => {
                      const eq = equipmentList.find(e => e.id === shift.equipmentId);
                      return (
                        <div
                          key={shift.id}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-white">
                              {shift.waybillNumber || shift.shiftNumber} · {shift.date} ·{' '}
                              <span className="font-mono text-amber-400 tabular-nums">{shift.workHours} ч</span>
                            </div>
                            <div className="text-slate-400">
                              {eq ? `[${eq.inventoryNumber}] ${eq.name}` : shift.equipmentId} · Машинист: {shift.operatorName} · {shift.siteName}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmShiftInBot(shift, 'confirm')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Подтвердить часы</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmShiftInBot(shift, 'question')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Уточнить</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {botScreen === 'message' && (
                botConfig.allowSiteChatAndPhotos ? (
                  <form onSubmit={handleSendDirectMessage} className="space-y-2.5">
                    <p className="text-slate-400">
                      Сообщение уйдёт напрямую в корпоративный чат участка [{branch.code}] для{' '}
                      <strong className="text-slate-200">{branch.fleetManagerName}</strong>.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Например: Просим подать кран к 08:30 на ворота №2..."
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={!customMessage.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Отправить</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-center">
                    Сообщения заказчика через Бот MAX отключены Fleet Manager.
                  </div>
                )
              )}

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Документы из MAX маршрутизируются строго на участок {branch.code}
                </span>
                <span className="font-mono">{branch.documentFlow.actPrefix}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
