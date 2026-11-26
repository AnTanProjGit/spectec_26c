import React from 'react';
import {
  X,
  Building2,
  FileText,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Briefcase,
  Truck,
  CheckCircle2,
  Clock,
  Bot,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';
import {
  AccountingSubjectId,
  CRMStage,
  Equipment,
  FleetBranch,
  LegalDocKind,
  LegalDocStatus,
  OneCIntegrationConfig
} from '../types';
import { BranchCustomerRow } from '../utils/clientDirectory';

interface CustomerCardModalProps {
  customer: BranchCustomerRow | null;
  branch: FleetBranch;
  equipmentList: Equipment[];
  oneCConfig: OneCIntegrationConfig;
  onClose: () => void;
  onOpenContract: (payload: {
    docId?: string;
    docNumber?: string;
    clientName: string;
    branchId: string;
    orderNumber?: string;
    subjectId: AccountingSubjectId;
    hasContract: boolean;
  }) => void;
  onOpenChat?: (payload: {
    branchId: string;
    clientName: string;
    contactPerson: string;
    phone: string;
    dealId?: string;
  }) => void;
}

const STAGE_LABELS: Record<CRMStage, string> = {
  lead: '1. Новая заявка',
  calculation: '2. Расчёт сметы',
  contract: '3. Согласование договора',
  active: '4. Техника на объекте',
  completed: '5. Завершено / Актировано'
};

const DOC_KIND_LABELS: Record<LegalDocKind, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  dispute: 'Спор',
  claim: 'Претензия',
  template: 'Шаблон'
};

const DOC_STATUS_LABELS: Record<LegalDocStatus, string> = {
  draft: 'Черновик',
  review: 'На согласовании',
  active: 'Действует',
  dispute: 'Спор',
  resolved: 'Урегулирован',
  archived: 'Архив'
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  active: 'В работе',
  scheduled: 'Запланирован',
  completed: 'Завершён',
  suspended: 'Приостановлен'
};

export const CustomerCardModal: React.FC<CustomerCardModalProps> = ({
  customer,
  branch,
  equipmentList,
  oneCConfig,
  onClose,
  onOpenContract,
  onOpenChat
}) => {
  if (!customer) return null;

  const subject = oneCConfig.subjects[customer.subjectId];
  const isOsn = customer.subjectId === 'ooo_specialtech';
  const equipmentMap = new Map(equipmentList.map(eq => [eq.id, eq]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-card-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-300">
                <Building2 className="w-3.5 h-3.5" />
                {customer.opf} · [{branch.code}]
              </span>
              <span className="text-slate-600">·</span>
              <span
                className={`text-[11px] font-semibold ${
                  customer.isActive ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {customer.isActive ? 'Активный заказчик' : 'Закрыт'}
              </span>
              {customer.isRegularMax && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-sky-300">
                    <Bot className="w-3 h-3" />
                    Подключён к Боту MAX
                  </span>
                </>
              )}
            </div>
            <h2
              id="customer-card-title"
              className="text-lg font-bold text-white tracking-tight truncate"
            >
              {customer.fullName}
            </h2>
            <p className="text-xs text-slate-400">
              Маршрут 1С:{' '}
              <span className={isOsn ? 'text-sky-300 font-medium' : 'text-amber-300 font-medium'}>
                {subject.entityName} ({subject.taxSystem})
              </span>{' '}
              · Подразделение {branch.documentFlow.oneCDepartmentCode} · Ответственный: {customer.managerName}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>К списку</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть карточку заказчика"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Оборот по участку</div>
              <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                {customer.turnoverRub.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                Оплачено: {customer.paidRub.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Дебиторская задолженность</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  customer.debtRub > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {customer.debtRub.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {customer.debtRub > 0 ? 'Требует контроля оплаты' : 'Просрочки нет'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Заказы и сделки CRM</div>
              <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                {customer.ordersCount} зак. · {customer.dealsCount} сдел.
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Статус: {customer.statusDetail}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Объём работ (моточасы)</div>
              <div className="text-base font-bold text-amber-300 font-mono tabular-nums mt-0.5">
                {customer.totalHoursWorked.toLocaleString('ru-RU')} м/ч
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Поток: {branch.documentFlow.orderPrefix}
              </div>
            </div>
          </div>

          {/* Legal Requisites + Contacts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                <Landmark className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                  Реквизиты организации и банк
                </h3>
              </div>

              <dl className="space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">ИНН / КПП:</dt>
                  <dd className="font-mono text-slate-200 text-right tabular-nums">
                    {customer.inn}
                    {customer.kpp !== '—' ? ` / ${customer.kpp}` : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">ОГРН / ОГРНИП:</dt>
                  <dd className="font-mono text-slate-200 text-right tabular-nums">
                    {customer.ogrn}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">Руководитель:</dt>
                  <dd className="text-slate-200 text-right">{customer.director}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">Юр. адрес:</dt>
                  <dd className="text-slate-300 text-right">{customer.legalAddress}</dd>
                </div>
                <div className="pt-1.5 border-t border-slate-800/70 flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">Банк:</dt>
                  <dd className="text-slate-200 text-right">{customer.bankName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">Расчётный счёт:</dt>
                  <dd className="font-mono text-slate-200 text-right tabular-nums">
                    {customer.checkingAccount}
                  </dd>
                </div>
                {customer.bik !== '—' && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400 shrink-0">БИК / К/с:</dt>
                    <dd className="font-mono text-slate-300 text-right tabular-nums">
                      {customer.bik} · {customer.corrAccount}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                <Phone className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                  Контакты, ЭДО и объекты работ
                </h3>
              </div>

              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">Контактное лицо:</dt>
                  <dd className="text-white font-medium text-right">{customer.contactPerson}</dd>
                </div>
                <div className="flex justify-between gap-3 items-center">
                  <dt className="text-slate-400 shrink-0">Телефон:</dt>
                  <dd className="text-right">
                    {onOpenChat ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenChat({
                            branchId: branch.id,
                            clientName: customer.clientName,
                            contactPerson: customer.contactPerson,
                            phone: customer.phone,
                            dealId: customer.latestDealId
                          })
                        }
                        title="Перейти к переписке в чате"
                        className="inline-flex items-center gap-1.5 font-mono text-sky-300 hover:text-sky-200 underline decoration-sky-500/40 underline-offset-2 tabular-nums cursor-pointer"
                      >
                        <span>{customer.phone}</span>
                        <MessageSquare className="w-3 h-3 shrink-0" />
                      </button>
                    ) : (
                      <span className="font-mono text-sky-300 tabular-nums">{customer.phone}</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-mail:
                  </dt>
                  <dd className="font-mono text-slate-300 text-right">{customer.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400 shrink-0">Документооборот:</dt>
                  <dd className="text-slate-200 text-right">
                    {customer.hasContract
                      ? 'По договору (ЭДО: УПД / КС-2 / ЭСМ-7)'
                      : 'Без договора (оферта / ККТ 54-ФЗ / СБП)'}
                  </dd>
                </div>
                <div className="pt-1.5 border-t border-slate-800/70">
                  <div className="text-slate-400 flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Строительные объекты заказчика:
                  </div>
                  {customer.allSites.length === 0 ? (
                    <div className="text-slate-500">Объекты не зафиксированы в заказах</div>
                  ) : (
                    <ul className="space-y-1">
                      {customer.allSites.map(site => (
                        <li key={site} className="text-slate-200 flex items-start gap-1.5">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>{site}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </dl>
            </div>
          </div>

          {/* Contracts & Legal Docs */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                  Договоры и юридические документы ({customer.matchingContracts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenContract({
                    docId: customer.primaryContractDoc?.id,
                    docNumber: customer.primaryContractDoc?.number,
                    clientName: customer.clientName,
                    branchId: branch.id,
                    orderNumber: customer.latestOrderNumber,
                    subjectId: customer.subjectId,
                    hasContract: customer.hasContract
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 transition cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>
                  {customer.primaryContractDoc
                    ? `Перейти к договору ${customer.primaryContractDoc.number}`
                    : 'Открыть / оформить договор'}
                </span>
              </button>
            </div>

            {customer.matchingContracts.length === 0 ? (
              <div className="text-slate-400 py-2">
                В реестре юридических документов пока нет отдельной записи для «{customer.clientName}». Нажмите
                «Открыть / оформить договор», чтобы сформировать и открыть документ с заполненными реквизитами.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {customer.matchingContracts.map(doc => (
                  <div
                    key={doc.id}
                    className="py-2 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenContract({
                              docId: doc.id,
                              docNumber: doc.number,
                              clientName: customer.clientName,
                              branchId: branch.id,
                              orderNumber: doc.linkedOrderNumber || customer.latestOrderNumber,
                              subjectId: doc.accountingSubject,
                              hasContract: customer.hasContract
                            })
                          }
                          className="font-mono font-bold text-amber-300 hover:text-amber-200 underline decoration-amber-500/40 underline-offset-2 cursor-pointer"
                        >
                          {doc.number}
                        </button>
                        <span className="text-slate-400">· {DOC_KIND_LABELS[doc.kind]}</span>
                        <span
                          className={
                            doc.status === 'active'
                              ? 'text-emerald-400 font-medium'
                              : doc.status === 'dispute'
                                ? 'text-rose-400 font-medium'
                                : 'text-amber-300'
                          }
                        >
                          · {DOC_STATUS_LABELS[doc.status]}
                        </span>
                      </div>
                      <div className="text-slate-300 truncate mt-0.5">{doc.title}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-white font-semibold">
                        {doc.amountRub.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-[11px] text-slate-400">от {doc.createdAt}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders & CRM Deals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                <Truck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                  Заказы-наряды аренды ({customer.matchingOrders.length})
                </h3>
              </div>

              {customer.matchingOrders.length === 0 ? (
                <div className="text-slate-500 py-2">Активных или архивных заказов-нарядов нет.</div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {customer.matchingOrders.map(ord => {
                    const eq = equipmentMap.get(ord.equipmentId);
                    return (
                      <div key={ord.id} className="py-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-amber-300">
                            {ord.orderNumber}
                          </span>
                          <span className="text-emerald-400 font-medium">
                            {ORDER_STATUS_LABELS[ord.status] || ord.status}
                          </span>
                        </div>
                        <div className="text-slate-200">
                          {eq ? `[${eq.inventoryNumber}] ${eq.name}` : ord.equipmentId} · Экипаж: {ord.operatorName}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                          <span>
                            {ord.actualHours}/{ord.plannedHours} м/ч × {ord.hourlyRate.toLocaleString('ru-RU')} ₽
                          </span>
                          <span className="text-white font-semibold">
                            {ord.totalAmount.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate pr-2">{ord.siteAddress}</span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            {ord.actSigned ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Акт подписан</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>Акт на подписи</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                <Briefcase className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                  Заявки и сделки CRM ({customer.matchingDeals.length})
                </h3>
              </div>

              {customer.matchingDeals.length === 0 ? (
                <div className="text-slate-500 py-2">Заявок в CRM по этому заказчику нет.</div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {customer.matchingDeals.map(deal => (
                    <div key={deal.id} className="py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">
                          {STAGE_LABELS[deal.stage]}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {deal.dateCreated}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono tabular-nums">
                        <span>
                          {deal.hoursRequested} м/ч × {deal.hourlyRateAgreed.toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-white font-semibold">
                          {deal.estimatedAmount.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate pr-2">{deal.siteAddress}</span>
                        {deal.debtAmount > 0 && (
                          <span className="text-rose-400 font-mono shrink-0">
                            Долг: {deal.debtAmount.toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
