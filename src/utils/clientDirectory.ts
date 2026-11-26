import {
  AccountingSubjectId,
  CRMDeal,
  CRMStage,
  FleetBranch,
  LegalDocument,
  OneCIntegrationConfig,
  RentalOrder
} from '../types';
import { resolveAccountingSubject } from './accounting1c';

export interface ClientOrgDirectoryMeta {
  fullName: string;
  opf: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  director: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  corrAccount: string;
  email: string;
  contactFallback?: string;
  phoneFallback?: string;
}

export const CLIENT_ORG_DIRECTORY: Record<string, ClientOrgDirectoryMeta> = {
  'ООО «Монолит-Строй»': {
    fullName: 'Общество с ограниченной ответственностью «Монолит-Строй»',
    opf: 'ООО',
    inn: '7713998877',
    kpp: '771301001',
    ogrn: '1187746990112',
    legalAddress: '127474, г. Москва, Дмитровское ш., д. 82, стр. 3, оф. 405',
    director: 'Захаров Роман Олегович',
    bankName: 'ПАО «Столичный ПромБанк» г. Москва',
    bik: '044525888',
    checkingAccount: '40702810100000054321',
    corrAccount: '30101810200000000888',
    email: 'docs@monolit-demo.ru',
    contactFallback: 'Захаров Роман Олегович',
    phoneFallback: '+7 (495) 781-44-12'
  },
  'АО «Автодор-Инвест»': {
    fullName: 'Акционерное общество «Автодор-Инвест»',
    opf: 'АО',
    inn: '7705412890',
    kpp: '770501001',
    ogrn: '1157746321890',
    legalAddress: '115054, г. Москва, Павелецкая пл., д. 2, стр. 1',
    director: 'Степанов Илья Борисович',
    bankName: 'АО «Восточно-Столичный Банк» г. Москва',
    bik: '044525999',
    checkingAccount: '40702810300000019284',
    corrAccount: '30101810400000000999',
    email: 'edo@avtodor-invest-demo.ru',
    contactFallback: 'Степанов Илья Борисович',
    phoneFallback: '+7 (495) 912-30-00'
  },
  'ООО «ГрандСтройИнвест»': {
    fullName: 'Общество с ограниченной ответственностью «ГрандСтройИнвест»',
    opf: 'ООО',
    inn: '7728887766',
    kpp: '772801001',
    ogrn: '1177746554433',
    legalAddress: '117342, г. Москва, ул. Профсоюзная, д. 76, корп. 2, эт. 5',
    director: 'Морозов А. В.',
    bankName: 'ПАО «Столичный ПромБанк» г. Москва',
    bik: '044525888',
    checkingAccount: '40702810800000077215',
    corrAccount: '30101810200000000888',
    email: 'buh@grandstroy-demo.ru',
    contactFallback: 'Карпов Геннадий Сергеевич',
    phoneFallback: '+7 (916) 334-11-88'
  },
  'ООО «ДорСтройХолдинг»': {
    fullName: 'Общество с ограниченной ответственностью «ДорСтройХолдинг»',
    opf: 'ООО',
    inn: '7721643091',
    kpp: '772101001',
    ogrn: '1197746110482',
    legalAddress: '109428, г. Москва, Рязанский пр-т, д. 24, корп. 1',
    director: 'Воронов Андрей Викторович',
    bankName: 'АО «Деловой Кредит» г. Москва',
    bik: '044525411',
    checkingAccount: '40702810500000033490',
    corrAccount: '30101810100000000411',
    email: 'contract@dorstroy-demo.ru',
    contactFallback: 'Воронов Андрей Викторович',
    phoneFallback: '+7 (926) 450-20-10'
  },
  'ГК «Пионер Развитие»': {
    fullName: 'Группа компаний «Пионер Развитие» (ООО «Пионер Развитие»)',
    opf: 'ГК (ООО)',
    inn: '7715809234',
    kpp: '771501001',
    ogrn: '1167746809120',
    legalAddress: '127282, г. Москва, ул. Полярная, д. 25, эт. 4',
    director: 'Беляева Марина Игоревна',
    bankName: 'АО «Восточно-Столичный Банк» г. Москва',
    bik: '044525999',
    checkingAccount: '40702810200000061209',
    corrAccount: '30101810400000000999',
    email: 'tender@pioner-demo.ru',
    contactFallback: 'Беляева Марина Игоревна',
    phoneFallback: '+7 (495) 604-89-11'
  },
  'ООО «НерудТранс»': {
    fullName: 'Общество с ограниченной ответственностью «НерудТранс»',
    opf: 'ООО',
    inn: '5004031982',
    kpp: '500401001',
    ogrn: '1185024009145',
    legalAddress: '143600, МО, г. Волоколамск, Рижское ш., д. 9',
    director: 'Григорьев С. М.',
    bankName: 'ПАО «Столичный ПромБанк» г. Москва',
    bik: '044525888',
    checkingAccount: '40702810900000041822',
    corrAccount: '30101810200000000888',
    email: 'logist@nerudtrans-demo.ru',
    contactFallback: 'Диспетчерская карьера',
    phoneFallback: '+7 (496) 362-18-40'
  },
  'ООО «ТрансСтройСеть»': {
    fullName: 'Общество с ограниченной ответственностью «ТрансСтройСеть»',
    opf: 'ООО',
    inn: '5047218940',
    kpp: '504701001',
    ogrn: '1205000041288',
    legalAddress: '141400, МО, г. Химки, Вашутинское ш., д. 18',
    director: 'Алексеев Денис Константинович',
    bankName: 'АО «Деловой Кредит» г. Москва',
    bik: '044525411',
    checkingAccount: '40702810700000050193',
    corrAccount: '30101810100000000411',
    email: 'info@transstroyset-demo.ru',
    contactFallback: 'Алексеев Денис Константинович',
    phoneFallback: '+7 (903) 712-40-55'
  },
  'ООО «ИнфраИнжиниринг»': {
    fullName: 'Общество с ограниченной ответственностью «ИнфраИнжиниринг»',
    opf: 'ООО',
    inn: '5027319044',
    kpp: '502701001',
    ogrn: '1215000019874',
    legalAddress: '140054, МО, г. Котельники, Дзержинское ш., д. 7',
    director: 'Марков Юрий Павлович',
    bankName: 'АО «Восточно-Столичный Банк» г. Москва',
    bik: '044525999',
    checkingAccount: '40702810100000088920',
    corrAccount: '30101810400000000999',
    email: 'pto@infrainzh-demo.ru',
    contactFallback: 'Марков Юрий Павлович',
    phoneFallback: '+7 (495) 332-90-88'
  },
  'ООО «ТатСтройМост»': {
    fullName: 'Общество с ограниченной ответственностью «ТатСтройМост»',
    opf: 'ООО',
    inn: '1655998877',
    kpp: '165501001',
    ogrn: '1161690887766',
    legalAddress: '420107, г. Казань, ул. Спартаковская, д. 119, оф. 210',
    director: 'Халиуллин Марат Рамилевич',
    bankName: 'ПАО «Камский КоммерцБанк» г. Казань',
    bik: '049205666',
    checkingAccount: '40702810400000066554',
    corrAccount: '30101810500000000666',
    email: 'office@tatstroymost-demo.ru',
    contactFallback: 'Халиуллин Марат Рашидович',
    phoneFallback: '+7 (843) 518-22-40'
  },
  'АО «КазаньПромИнвест»': {
    fullName: 'Акционерное общество «КазаньПромИнвест»',
    opf: 'АО',
    inn: '1660776655',
    kpp: '166001001',
    ogrn: '1141690112233',
    legalAddress: '420061, г. Казань, ул. Ершова, д. 31А, оф. 12',
    director: 'Садыков Р. К.',
    bankName: 'ПАО «Камский КоммерцБанк» г. Казань',
    bik: '049205666',
    checkingAccount: '40702810600000090211',
    corrAccount: '30101810500000000666',
    email: 'fin@kazanprominvest-demo.ru',
    contactFallback: 'Нуриев Рустем Фаритович',
    phoneFallback: '+7 (843) 224-11-90'
  },
  'ООО «ВолгаДорСервис»': {
    fullName: 'Общество с ограниченной ответственностью «ВолгаДорСервис»',
    opf: 'ООО',
    inn: '1658194022',
    kpp: '165801001',
    ogrn: '1191690034811',
    legalAddress: '420095, г. Казань, ул. Восстания, д. 100, оф. 308',
    director: 'Егоров Сергей Анатольевич',
    bankName: 'Поволжский филиал АО «Восточно-Столичный Банк»',
    bik: '049205777',
    checkingAccount: '40702810200000031405',
    corrAccount: '30101810600000000777',
    email: 'snab@volgador-demo.ru',
    contactFallback: 'Егоров Сергей Анатольевич',
    phoneFallback: '+7 (917) 881-44-09'
  },
  'ООО «Иннополис-Строй»': {
    fullName: 'Общество с ограниченной ответственностью «Иннополис-Строй»',
    opf: 'ООО',
    inn: '1615014892',
    kpp: '161501001',
    ogrn: '1201600049120',
    legalAddress: '420500, РТ, г. Иннополис, ул. Университетская, д. 7',
    director: 'Закиров Тимур Наилевич',
    bankName: 'Поволжский филиал АО «Восточно-Столичный Банк»',
    bik: '049205777',
    checkingAccount: '40702810500000044812',
    corrAccount: '30101810600000000777',
    email: 'docs@innostroy-demo.ru',
    contactFallback: 'Закиров Тимур Наилевич',
    phoneFallback: '+7 (843) 202-34-15'
  },
  'Ахметов И. Р. (Частный заказ)': {
    fullName: 'Ахметов Ильдар Рашидович (Физическое лицо)',
    opf: 'ФЛ',
    inn: '165912408911',
    kpp: '—',
    ogrn: '—',
    legalAddress: 'РТ, г. Казань, пос. Салмачи, ул. Центральная, уч. 18',
    director: 'Ахметов Ильдар Рашидович',
    bankName: 'Оплата СБП / Карта физ. лица (чек 54-ФЗ)',
    bik: '—',
    checkingAccount: 'СБП +7 (987) 210-77-31',
    corrAccount: '—',
    email: 'akhmetov.ir@client-demo.ru',
    contactFallback: 'Ахметов Ильдар',
    phoneFallback: '+7 (987) 210-77-31'
  }
};

export function inferOpfFromName(name: string, isIndividual: boolean): string {
  const trimmed = name.trim();
  if (/^ООО\b/i.test(trimmed)) return 'ООО';
  if (/^ПАО\b/i.test(trimmed)) return 'ПАО';
  if (/^ЗАО\b/i.test(trimmed)) return 'ЗАО';
  if (/^АО\b/i.test(trimmed)) return 'АО';
  if (/^ГК\b/i.test(trimmed)) return 'ГК (ЮЛ)';
  if (/^ИП\b/i.test(trimmed)) return 'ИП';
  return isIndividual ? 'ФЛ' : 'ЮЛ';
}

const STAGE_LABELS: Record<CRMStage, string> = {
  lead: '1. Новая заявка',
  calculation: '2. Расчёт сметы',
  contract: '3. Согласование договора',
  active: '4. Техника на объекте',
  completed: '5. Завершено / Актировано'
};

export type CustomerPeriodMode = 'all' | 'date' | 'month' | 'year';

export interface CustomerPeriodFilter {
  mode: CustomerPeriodMode;
  date: string;
  month: string;
  year: string;
}

function matchesDealPeriod(deal: CRMDeal, filter?: CustomerPeriodFilter): boolean {
  if (!filter || filter.mode === 'all') return true;
  if (filter.mode === 'date') return Boolean(filter.date) && deal.dateCreated === filter.date;
  if (filter.mode === 'month') return Boolean(filter.month) && deal.dateCreated.slice(0, 7) === filter.month;
  if (filter.mode === 'year') return Boolean(filter.year) && deal.dateCreated.slice(0, 4) === filter.year;
  return true;
}

function matchesOrderPeriod(order: RentalOrder, filter?: CustomerPeriodFilter): boolean {
  if (!filter || filter.mode === 'all') return true;
  const start = order.startDate || '';
  const end = order.endDate || start;
  if (!start) return false;
  if (filter.mode === 'date') {
    return Boolean(filter.date) && start <= filter.date && end >= filter.date;
  }
  if (filter.mode === 'month') {
    return (
      Boolean(filter.month) &&
      start.slice(0, 7) <= filter.month &&
      end.slice(0, 7) >= filter.month
    );
  }
  if (filter.mode === 'year') {
    return (
      Boolean(filter.year) &&
      start.slice(0, 4) <= filter.year &&
      end.slice(0, 4) >= filter.year
    );
  }
  return true;
}

function matchesLegalDocPeriod(doc: LegalDocument, filter?: CustomerPeriodFilter): boolean {
  if (!filter || filter.mode === 'all') return true;
  const created = doc.createdAt || '';
  const updated = doc.updatedAt || '';
  if (filter.mode === 'date') {
    return Boolean(filter.date) && (created === filter.date || updated === filter.date);
  }
  if (filter.mode === 'month') {
    return (
      Boolean(filter.month) &&
      (created.slice(0, 7) === filter.month || updated.slice(0, 7) === filter.month)
    );
  }
  if (filter.mode === 'year') {
    return (
      Boolean(filter.year) &&
      (created.slice(0, 4) === filter.year || updated.slice(0, 4) === filter.year)
    );
  }
  return true;
}

export interface BranchCustomerRow {
  clientName: string;
  fullName: string;
  isRegularMax: boolean;
  opf: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  director: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  corrAccount: string;
  email: string;
  siteAddress: string;
  allSites: string[];
  contactPerson: string;
  phone: string;
  hasContract: boolean;
  dealsCount: number;
  ordersCount: number;
  totalHoursWorked: number;
  lastContractNumber: string;
  lastContractCaption: string;
  primaryContractDoc?: LegalDocument;
  latestOrderNumber?: string;
  latestDealId?: string;
  matchingContracts: LegalDocument[];
  matchingOrders: RentalOrder[];
  matchingDeals: CRMDeal[];
  isActive: boolean;
  statusDetail: string;
  turnoverRub: number;
  paidRub: number;
  debtRub: number;
  subjectId: AccountingSubjectId;
  managerName: string;
}

export function buildBranchCustomerRows(params: {
  branch: FleetBranch;
  deals: CRMDeal[];
  orders: RentalOrder[];
  legalDocuments: LegalDocument[];
  oneCConfig: OneCIntegrationConfig;
  periodFilter?: CustomerPeriodFilter;
}): BranchCustomerRow[] {
  const { branch, deals, orders, legalDocuments, oneCConfig, periodFilter } = params;
  const isPeriodActive = Boolean(periodFilter && periodFilter.mode !== 'all');

  const allBranchDeals = deals.filter(d => d.branchId === branch.id);
  const allBranchOrders = orders.filter(o => o.branchId === branch.id);

  const branchDeals = isPeriodActive
    ? allBranchDeals.filter(d => matchesDealPeriod(d, periodFilter))
    : allBranchDeals;
  const branchOrders = isPeriodActive
    ? allBranchOrders.filter(o => matchesOrderPeriod(o, periodFilter))
    : allBranchOrders;
  const branchLegalDocs = legalDocuments.filter(
    doc =>
      doc.branchId === branch.id &&
      (doc.kind === 'contract' ||
        doc.kind === 'addendum' ||
        doc.kind === 'dispute' ||
        doc.kind === 'claim')
  );
  const periodLegalDocs = isPeriodActive
    ? branchLegalDocs.filter(doc => matchesLegalDocPeriod(doc, periodFilter))
    : branchLegalDocs;

  const regularSet = new Set(branch.regularClients);

  const allClientNames: string[] = [];
  const seenClients = new Set<string>();
  const pushClient = (name: string) => {
    const normalized = name.trim();
    if (!normalized || seenClients.has(normalized)) return;
    seenClients.add(normalized);
    allClientNames.push(normalized);
  };

  if (!isPeriodActive) {
    branch.regularClients.forEach(pushClient);
  }
  branchOrders.forEach(o => pushClient(o.clientName));
  branchDeals.forEach(d => pushClient(d.clientName));
  if (isPeriodActive) {
    periodLegalDocs.forEach(doc => pushClient(doc.counterparty));
  }

  return allClientNames.map(clientName => {
    const matchingDeals = branchDeals.filter(d => d.clientName === clientName);
    const matchingOrders = branchOrders.filter(o => o.clientName === clientName);
    const allClientDeals = allBranchDeals.filter(d => d.clientName === clientName);
    const allClientOrders = allBranchOrders.filter(o => o.clientName === clientName);

    const matchingContracts = (isPeriodActive ? periodLegalDocs : branchLegalDocs)
      .filter(doc => doc.counterparty === clientName)
      .sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
      );
    const allClientContracts = branchLegalDocs
      .filter(
        doc =>
          doc.counterparty === clientName &&
          (doc.kind === 'contract' || doc.kind === 'addendum')
      )
      .sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
      );

    const contractAndAddendumDocs = matchingContracts.filter(
      doc => doc.kind === 'contract' || doc.kind === 'addendum'
    );
    const meta = CLIENT_ORG_DIRECTORY[clientName];

    const latestDeal = matchingDeals[matchingDeals.length - 1];
    const latestOrder = matchingOrders[matchingOrders.length - 1];
    const fallbackDeal = allClientDeals[allClientDeals.length - 1];
    const fallbackOrder = allClientOrders[allClientOrders.length - 1];
    const primaryContractDoc =
      contractAndAddendumDocs.find(doc => doc.kind === 'contract') ||
      contractAndAddendumDocs[0] ||
      allClientContracts.find(doc => doc.kind === 'contract') ||
      allClientContracts[0];

    const looksIndividual =
      (latestDeal || fallbackDeal)?.clientType === 'individual' ||
      (latestOrder || fallbackOrder)?.clientType === 'individual' ||
      /частн|физ\.?\s*лицо|\bфл\b/i.test(clientName);

    const hasContract =
      (latestOrder || fallbackOrder)?.hasContract ??
      (latestDeal || fallbackDeal)?.hasContract ??
      !looksIndividual;

    const explicitSubject =
      (latestOrder || fallbackOrder)?.accountingSubject ||
      (latestDeal || fallbackDeal)?.accountingSubject;

    const subjectId: AccountingSubjectId =
      explicitSubject ||
      resolveAccountingSubject(
        looksIndividual ? 'individual' : 'legal_entity',
        hasContract,
        oneCConfig.routing
      ).subjectId;

    const ordersTurnover = matchingOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const dealsTurnover = matchingDeals.reduce((acc, d) => acc + d.estimatedAmount, 0);
    const turnoverRub = ordersTurnover > 0 ? ordersTurnover : dealsTurnover;
    const paidRub = matchingOrders.reduce((acc, o) => acc + o.paidAmount, 0);
    const ordersDebt = matchingOrders.reduce(
      (acc, o) => acc + Math.max(0, o.totalAmount - o.paidAmount),
      0
    );
    const dealsDebt = matchingDeals.reduce((acc, d) => acc + (d.debtAmount || 0), 0);
    const debtRub = Math.max(ordersDebt, dealsDebt);

    const totalHoursWorked =
      matchingOrders.length > 0
        ? matchingOrders.reduce((acc, o) => acc + o.actualHours, 0)
        : matchingDeals.reduce((acc, d) => acc + d.hoursRequested, 0);

    const lastContractNumber = primaryContractDoc
      ? primaryContractDoc.number
      : latestOrder
        ? latestOrder.orderNumber
        : !hasContract
          ? 'Оферта / без договора'
          : latestDeal
            ? `CRM · ${latestDeal.dateCreated}`
            : 'Не оформлен';

    const lastContractCaption = primaryContractDoc
      ? `от ${primaryContractDoc.createdAt} · ${matchingOrders.length} зак.`
      : latestOrder
        ? `Заказ-наряд · ${matchingOrders.length} зак. / ${matchingDeals.length} сдел.`
        : latestDeal
          ? STAGE_LABELS[latestDeal.stage]
          : 'Постоянный контрагент';

    const hasOpenOrder = matchingOrders.some(
      o => o.status === 'active' || o.status === 'scheduled'
    );
    const hasOpenDeal = matchingDeals.some(d => d.stage !== 'completed');
    const hasOpenContract = contractAndAddendumDocs.some(
      c => c.status === 'active' || c.status === 'review' || c.status === 'dispute'
    );
    const hasAnyActivity =
      matchingOrders.length > 0 ||
      matchingDeals.length > 0 ||
      contractAndAddendumDocs.length > 0;

    const isActive =
      hasOpenOrder ||
      hasOpenDeal ||
      hasOpenContract ||
      (!hasAnyActivity && regularSet.has(clientName));

    const activeOrdersCount = matchingOrders.filter(
      o => o.status === 'active' || o.status === 'scheduled'
    ).length;
    const statusDetail = isActive
      ? activeOrdersCount > 0
        ? `${activeOrdersCount} в работе`
        : hasOpenDeal
          ? 'Сделка в CRM'
          : 'Договор действует'
      : 'Все заказы закрыты';

    const opf = meta?.opf || inferOpfFromName(clientName, looksIndividual);
    const allSites = Array.from(
      new Set(
        [
          ...matchingOrders.map(o => o.siteAddress),
          ...matchingDeals.map(d => d.siteAddress),
          ...allClientOrders.map(o => o.siteAddress),
          ...allClientDeals.map(d => d.siteAddress)
        ].filter(Boolean)
      )
    );

    return {
      clientName,
      fullName: meta?.fullName || clientName,
      isRegularMax: regularSet.has(clientName),
      opf,
      inn: meta?.inn || 'По карточке 1С',
      kpp: meta?.kpp || (looksIndividual || opf === 'ИП' ? '—' : 'По ЕГРЮЛ'),
      ogrn: meta?.ogrn || '—',
      legalAddress:
        meta?.legalAddress ||
        (latestDeal || fallbackDeal)?.siteAddress ||
        (latestOrder || fallbackOrder)?.siteAddress ||
        branch.city,
      director:
        meta?.director ||
        (latestDeal || fallbackDeal)?.contactPerson ||
        'Руководитель не указан',
      bankName: meta?.bankName || 'По карточке 1С',
      bik: meta?.bik || '—',
      checkingAccount: meta?.checkingAccount || 'По карточке 1С',
      corrAccount: meta?.corrAccount || '—',
      email: meta?.email || '—',
      siteAddress:
        (latestOrder || fallbackOrder)?.siteAddress ||
        (latestDeal || fallbackDeal)?.siteAddress ||
        'По заявкам участка',
      allSites,
      contactPerson:
        (latestDeal || fallbackDeal)?.contactPerson ||
        meta?.contactFallback ||
        'Контактное лицо не указано',
      phone:
        (latestDeal || fallbackDeal)?.phone ||
        meta?.phoneFallback ||
        '—',
      hasContract,
      dealsCount: matchingDeals.length,
      ordersCount: matchingOrders.length,
      totalHoursWorked,
      lastContractNumber,
      lastContractCaption,
      primaryContractDoc,
      latestOrderNumber: (latestOrder || fallbackOrder)?.orderNumber,
      latestDealId: (latestDeal || fallbackDeal)?.id,
      matchingContracts,
      matchingOrders,
      matchingDeals,
      isActive,
      statusDetail,
      turnoverRub,
      paidRub,
      debtRub,
      subjectId,
      managerName: (latestDeal || fallbackDeal)?.manager || branch.fleetManagerName
    };
  });
}
