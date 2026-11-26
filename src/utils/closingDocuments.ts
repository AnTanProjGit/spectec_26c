import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import {
  AccountingSubjectId,
  CRMDeal,
  ClosingDocKind,
  ClosingDocumentRecord,
  FleetBranch,
  InvoiceStatus,
  OneCIntegrationConfig,
  RentalOrder,
  StatusNotificationSettings
} from '../types';

export interface SubjectRequisites {
  fullName: string;
  shortName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  okpo: string;
  address: string;
  bankName: string;
  bik: string;
  corrAccount: string;
  settlementAccount: string;
  directorTitle: string;
  directorFio: string;
  accountantFio: string;
  hasVat: boolean;
  vatRate: number;
  vatNote: string;
}

export const DEFAULT_STATUS_NOTIFICATION_SETTINGS: StatusNotificationSettings = {
  enabled: true,
  onVolumeCloseActKs2: true,
  onActSignedChange: true,
  onInvoiceIssued: true,
  onInvoiceStatusChange: true,
  sendToBranchChat: true,
  sendToMaxClientBot: false,
  remindDebtOverdueDays: 5
};

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  not_issued: {
    label: 'Счёт не выставлен',
    shortLabel: 'Не выставлен',
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700'
  },
  issued: {
    label: 'Счёт выставлен',
    shortLabel: 'Выставлен',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  },
  partially_paid: {
    label: 'Частично оплачен',
    shortLabel: 'Частично',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  paid: {
    label: 'Оплачен полностью',
    shortLabel: 'Оплачен',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  overdue: {
    label: 'Просрочен',
    shortLabel: 'Просрочен',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  }
};

export const CLOSING_DOC_KIND_LABELS: Record<ClosingDocKind, string> = {
  act_services: 'Акт оказанных услуг',
  ks2: 'Акт КС-2 (ОКУД 0322005)',
  ks3: 'Справка КС-3 (ОКУД 0322001)',
  invoice: 'Счёт на оплату услуг'
};

export function deriveActServicesPrefix(
  actPrefix?: string,
  branchCode: string = 'МСК'
): string {
  const clean = (actPrefix || '').trim();
  if (!clean) return `АКТ-${branchCode}-`;
  if (/^КС-?2-/i.test(clean)) {
    return `АКТ-${clean.replace(/^КС-?2-/i, '')}`;
  }
  return clean;
}

export function getKs2Prefix(branch?: FleetBranch | null): string {
  const branchCode = branch?.code || 'МСК';
  return branch?.documentFlow.actPrefix?.trim() || `КС2-${branchCode}-`;
}

export function getActServicesPrefix(branch?: FleetBranch | null): string {
  const branchCode = branch?.code || 'МСК';
  return deriveActServicesPrefix(branch?.documentFlow.actPrefix, branchCode);
}

export function resolveOrderInvoiceStatus(order: RentalOrder): InvoiceStatus {
  if (order.invoiceStatus) return order.invoiceStatus;
  if (order.paidAmount >= order.totalAmount && order.totalAmount > 0) return 'paid';
  if (order.paidAmount > 0) return 'partially_paid';
  if (order.actSigned) return 'issued';
  return 'not_issued';
}

export function resolveDealInvoiceStatus(deal: CRMDeal): InvoiceStatus {
  if (deal.invoiceStatus) return deal.invoiceStatus;
  const total = deal.estimatedAmount || 0;
  const paid = deal.paidAmount ?? Math.max(0, total - (deal.debtAmount || 0));
  if (deal.invoiceNumber) {
    if (total > 0 && paid >= total) return 'paid';
    if (paid > 0 && deal.debtAmount > 0) return 'partially_paid';
    return 'issued';
  }
  if (deal.stage === 'completed' && deal.debtAmount === 0) return 'paid';
  if (deal.debtAmount > 0 && deal.stage === 'completed') return 'overdue';
  return 'not_issued';
}

export function resolveAccountingSubjectForOrder(order: RentalOrder): AccountingSubjectId {
  if (order.accountingSubject) return order.accountingSubject;
  if (
    order.clientType === 'individual' ||
    order.clientName.toLowerCase().includes('частный')
  ) {
    return 'ip_specialtechnica';
  }
  return 'ooo_specialtech';
}

export function resolveAccountingSubjectForDeal(deal: CRMDeal): AccountingSubjectId {
  if (deal.accountingSubject) return deal.accountingSubject;
  if (
    deal.clientType === 'individual' ||
    deal.hasContract === false ||
    deal.clientName.toLowerCase().includes('частный')
  ) {
    return 'ip_specialtechnica';
  }
  return 'ooo_specialtech';
}

export function getSubjectRequisites(
  subjectId: AccountingSubjectId,
  oneCConfig: OneCIntegrationConfig,
  branch?: FleetBranch | null
): SubjectRequisites {
  const cfg = oneCConfig.subjects[subjectId];
  const cityAddress = branch?.baseAddress || 'г. Москва, Варшавское шоссе, д. 125, стр. 1';

  if (subjectId === 'ip_specialtechnica') {
    return {
      fullName: cfg?.entityName || 'Индивидуальный предприниматель «SpecialTechnica»',
      shortName: cfg?.shortName || 'ИП SpecialTechnica',
      inn: cfg?.inn || '772845190312',
      kpp: '—',
      ogrn: 'ОГРНИП 319774600412891',
      okpo: '0154829310',
      address: cityAddress,
      bankName: 'АО «ТБанк» г. Москва',
      bik: '044525974',
      corrAccount: '30101810145250000974',
      settlementAccount: '40802810400001849215',
      directorTitle: 'Индивидуальный предприниматель',
      directorFio: branch?.fleetManagerName || 'Волков И. А.',
      accountantFio: 'Не предусмотрен',
      hasVat: false,
      vatRate: 0,
      vatNote: 'Без налога (НДС) на основании п. 2 ст. 346.11 НК РФ (УСН 6%)'
    };
  }

  return {
    fullName: cfg?.entityName || 'Общество с ограниченной ответственностью «SpecialTech»',
    shortName: cfg?.shortName || 'ООО SpecialTech',
    inn: cfg?.inn || '7709482154',
    kpp: '770901001',
    ogrn: 'ОГРН 1187746512098',
    okpo: '32891405',
    address: cityAddress,
    bankName: 'ПАО Сбербанк г. Москва',
    bik: '044525225',
    corrAccount: '30101810400000000225',
    settlementAccount: '40702810938000142587',
    directorTitle: 'Генеральный директор',
    directorFio: branch?.fleetManagerName || 'Волков И. А.',
    accountantFio: 'Морозова Е. В.',
    hasVat: true,
    vatRate: 20,
    vatNote: 'В том числе НДС 20%'
  };
}

export function calculateVatRub(totalAmountRub: number, subjectId: AccountingSubjectId): number {
  if (subjectId === 'ip_specialtechnica') return 0;
  return Math.round((totalAmountRub * 20) / 120);
}

function formatDateRu(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
  if (!m) return isoDate;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatMoneyRu(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function amountToRussianWords(amountRub: number): string {
  const rounded = Math.max(0, Math.round(amountRub * 100));
  const rubles = Math.floor(rounded / 100);
  const kopeks = rounded % 100;

  const unitsM = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const unitsF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = [
    'десять',
    'одиннадцать',
    'двенадцать',
    'тринадцать',
    'четырнадцать',
    'пятнадцать',
    'шестнадцать',
    'семнадцать',
    'восемнадцать',
    'девятнадцать'
  ];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = [
    '',
    'сто',
    'двести',
    'триста',
    'четыреста',
    'пятьсот',
    'шестьсот',
    'семьсот',
    'восемьсот',
    'девятьсот'
  ];

  const plural = (n: number, one: string, few: string, many: string) => {
    const n100 = n % 100;
    const n10 = n % 10;
    if (n100 >= 11 && n100 <= 19) return many;
    if (n10 === 1) return one;
    if (n10 >= 2 && n10 <= 4) return few;
    return many;
  };

  const triadToWords = (num: number, feminine: boolean): string => {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    const parts: string[] = [];
    if (h > 0) parts.push(hundreds[h]);
    if (t === 1) {
      parts.push(teens[u]);
    } else {
      if (t > 1) parts.push(tens[t]);
      if (u > 0) parts.push((feminine ? unitsF : unitsM)[u]);
    }
    return parts.join(' ');
  };

  let words = '';
  if (rubles === 0) {
    words = 'Ноль рублей';
  } else {
    const billions = Math.floor(rubles / 1_000_000_000);
    const millions = Math.floor((rubles % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((rubles % 1_000_000) / 1_000);
    const rest = rubles % 1_000;

    const parts: string[] = [];
    if (billions > 0) {
      parts.push(triadToWords(billions, false), plural(billions, 'миллиард', 'миллиарда', 'миллиардов'));
    }
    if (millions > 0) {
      parts.push(triadToWords(millions, false), plural(millions, 'миллион', 'миллиона', 'миллионов'));
    }
    if (thousands > 0) {
      parts.push(triadToWords(thousands, true), plural(thousands, 'тысяча', 'тысячи', 'тысяч'));
    }
    if (rest > 0) {
      parts.push(triadToWords(rest, false));
    }
    parts.push(plural(rubles, 'рубль', 'рубля', 'рублей'));
    const joined = parts.filter(Boolean).join(' ');
    words = joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  const kopeksStr = String(kopeks).padStart(2, '0');
  const kopeksWord = plural(kopeks, 'копейка', 'копейки', 'копеек');
  return `${words} ${kopeksStr} ${kopeksWord}`;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const COMMON_A4_PRINT_CSS = `
  @page { size: A4; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.32;
    color: #111827;
    background: #ffffff;
    margin: 0;
    padding: 14px 18px;
  }
  h1, h2 { margin: 0; }
  table { border-collapse: collapse; width: 100%; }
  .doc-title {
    font-size: 13.5pt;
    font-weight: 700;
    border-bottom: 2px solid #111827;
    padding-bottom: 6px;
    margin-bottom: 10px;
  }
  .meta-table td {
    padding: 3px 4px;
    vertical-align: top;
    font-size: 10.5pt;
  }
  .meta-label {
    width: 145px;
    color: #374151;
    font-weight: 700;
  }
  .items-table th, .items-table td {
    border: 1px solid #111827;
    padding: 4px 6px;
    font-size: 10pt;
  }
  .items-table th {
    background: #f3f4f6;
    font-weight: 700;
    text-align: center;
  }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .totals-box {
    margin-top: 8px;
    width: 100%;
    font-size: 10.5pt;
  }
  .totals-row {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    margin-bottom: 2px;
  }
  .totals-label { font-weight: 700; min-width: 180px; text-align: right; }
  .totals-value { font-weight: 700; min-width: 110px; text-align: right; }
  .words-summary {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #d1d5db;
    font-size: 10.5pt;
  }
  .signatures {
    margin-top: 22px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    font-size: 10.5pt;
  }
  .sign-block {
    border-top: 1px solid #111827;
    padding-top: 4px;
    margin-top: 26px;
  }
  .stamp-note {
    margin-top: 10px;
    font-size: 9.5pt;
    color: #4b5563;
  }
`;

export function generateNormativeActHtml(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): string {
  const req = getSubjectRequisites(doc.accountingSubject, oneCConfig, branch);
  const vatAmount = calculateVatRub(doc.totalAmountRub, doc.accountingSubject);
  const dateRu = formatDateRu(doc.date);
  const periodText = `${formatDateRu(doc.periodStart)} — ${formatDateRu(doc.periodEnd)}`;
  const words = amountToRussianWords(doc.totalAmountRub);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Акт оказанных услуг № ${escapeHtml(doc.number)}</title>
  <style>${COMMON_A4_PRINT_CSS}</style>
</head>
<body>
  <div class="doc-title">
    Акт сдачи-приёмки оказанных услуг № ${escapeHtml(doc.number)} от ${escapeHtml(dateRu)} г.
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Исполнитель:</td>
      <td><strong>${escapeHtml(req.fullName)}</strong>, ИНН ${escapeHtml(req.inn)}${req.kpp !== '—' ? `, КПП ${escapeHtml(req.kpp)}` : ''}, ${escapeHtml(req.ogrn)}, адрес: ${escapeHtml(req.address)}</td>
    </tr>
    <tr>
      <td class="meta-label">Заказчик:</td>
      <td><strong>${escapeHtml(doc.clientName)}</strong>${doc.clientInn ? `, ИНН ${escapeHtml(doc.clientInn)}` : ''}${doc.clientAddress ? `, ${escapeHtml(doc.clientAddress)}` : ''}</td>
    </tr>
    <tr>
      <td class="meta-label">Основание:</td>
      <td>Договор / Заказ-наряд № ${escapeHtml(doc.orderOrDealNumber)} · Период работ: ${escapeHtml(periodText)}</td>
    </tr>
    <tr>
      <td class="meta-label">Объект работ:</td>
      <td>${escapeHtml(doc.siteAddress)} · Участок: ${escapeHtml(branch?.name || 'Головной участок')}</td>
    </tr>
  </table>

  <table class="items-table" style="margin-top: 10px;">
    <thead>
      <tr>
        <th style="width:36px;">№</th>
        <th>Наименование работ (услуг), марка техники и экипаж</th>
        <th style="width:65px;">Ед. изм.</th>
        <th style="width:72px;">Кол-во</th>
        <th style="width:92px;">Цена, ₽</th>
        <th style="width:105px;">Сумма, ₽</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td>
          ${escapeHtml(doc.workDescription)}<br/>
          <span style="font-size:9.5pt;color:#374151;">Техника: ${escapeHtml(doc.equipmentName)} · Машинист: ${escapeHtml(doc.operatorName)}</span>
        </td>
        <td class="text-center">${escapeHtml(doc.unitLabel)}</td>
        <td class="text-right">${doc.quantity}</td>
        <td class="text-right">${formatMoneyRu(doc.rateRub)}</td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="totals-box">
    <div class="totals-row">
      <div class="totals-label">Итого:</div>
      <div class="totals-value">${formatMoneyRu(doc.totalAmountRub)} ₽</div>
    </div>
    <div class="totals-row">
      <div class="totals-label">${req.hasVat ? 'В том числе НДС (20%):' : 'Без налога (НДС):'}</div>
      <div class="totals-value">${req.hasVat ? `${formatMoneyRu(vatAmount)} ₽` : '—'}</div>
    </div>
    <div class="totals-row">
      <div class="totals-label">Всего к оплате:</div>
      <div class="totals-value">${formatMoneyRu(doc.totalAmountRub)} ₽</div>
    </div>
  </div>

  <div class="words-summary">
    Всего оказано услуг 1, на сумму <strong>${formatMoneyRu(doc.totalAmountRub)} руб.</strong> (${escapeHtml(words)}).<br/>
    ${escapeHtml(req.vatNote)}.<br/>
    Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.
  </div>

  <div class="signatures">
    <div>
      <strong>ИСПОЛНИТЕЛЬ</strong><br/>
      ${escapeHtml(req.shortName)}
      <div class="sign-block">
        _________________ / ${escapeHtml(req.directorFio)} /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
    <div>
      <strong>ЗАКАЗЧИК</strong><br/>
      ${escapeHtml(doc.clientName)}
      <div class="sign-block">
        _________________ / _________________ /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateNormativeKs2Html(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): string {
  const req = getSubjectRequisites(doc.accountingSubject, oneCConfig, branch);
  const vatAmount = calculateVatRub(doc.totalAmountRub, doc.accountingSubject);
  const dateRu = formatDateRu(doc.date);
  const words = amountToRussianWords(doc.totalAmountRub);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>КС-2 № ${escapeHtml(doc.number)}</title>
  <style>
    ${COMMON_A4_PRINT_CSS}
    .ks2-top-stamp {
      text-align: right;
      font-size: 8.5pt;
      line-height: 1.25;
      margin-bottom: 6px;
    }
    .ks2-codes-table {
      width: auto;
      margin-left: auto;
      margin-bottom: 6px;
    }
    .ks2-codes-table td {
      border: 1px solid #111827;
      padding: 2px 8px;
      font-size: 9pt;
    }
    .ks2-header-table td {
      padding: 2px 4px;
      font-size: 9.5pt;
      vertical-align: bottom;
    }
    .ks2-underline {
      border-bottom: 1px solid #111827;
    }
    .ks2-num-box {
      border: 1px solid #111827;
      padding: 3px 6px;
      text-align: center;
      font-weight: 700;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>
  <div class="ks2-top-stamp">
    Унифицированная форма № КС-2<br/>
    Утверждена постановлением Госкомстата России от 11.11.99 № 100
  </div>

  <table class="ks2-codes-table">
    <tr>
      <td></td>
      <td class="text-center"><strong>Код</strong></td>
    </tr>
    <tr>
      <td>Форма по ОКУД</td>
      <td class="text-center"><strong>0322005</strong></td>
    </tr>
    <tr>
      <td>по ОКПО</td>
      <td class="text-center">${escapeHtml(req.okpo)}</td>
    </tr>
  </table>

  <table class="ks2-header-table">
    <tr>
      <td style="width:120px;">Инвестор:</td>
      <td class="ks2-underline">${escapeHtml(doc.clientName)}</td>
    </tr>
    <tr>
      <td>Заказчик (Генподрядчик):</td>
      <td class="ks2-underline"><strong>${escapeHtml(doc.clientName)}</strong>${doc.clientInn ? `, ИНН ${escapeHtml(doc.clientInn)}` : ''}</td>
    </tr>
    <tr>
      <td>Подрядчик (Субподрядчик):</td>
      <td class="ks2-underline"><strong>${escapeHtml(req.fullName)}</strong>, ИНН ${escapeHtml(req.inn)}${req.kpp !== '—' ? ` / КПП ${escapeHtml(req.kpp)}` : ''}</td>
    </tr>
    <tr>
      <td>Стройка:</td>
      <td class="ks2-underline">${escapeHtml(doc.siteAddress)}</td>
    </tr>
    <tr>
      <td>Объект:</td>
      <td class="ks2-underline">Производство работ спецтехникой (${escapeHtml(doc.equipmentName)}) · Участок: ${escapeHtml(branch?.name || 'Головной')}</td>
    </tr>
    <tr>
      <td>Договор подряда (контракт):</td>
      <td class="ks2-underline">№ ${escapeHtml(doc.orderOrDealNumber)}</td>
    </tr>
  </table>

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin: 10px 0 8px;">
    <div style="font-size:12pt; font-weight:700; text-transform:uppercase;">
      АКТ О ПРИЁМКЕ ВЫПОЛНЕННЫХ РАБОТ
    </div>
    <table style="width:auto;">
      <tr>
        <td class="ks2-num-box">Номер документа</td>
        <td class="ks2-num-box">Дата составления</td>
        <td class="ks2-num-box" colspan="2">Отчётный период</td>
      </tr>
      <tr>
        <td class="ks2-num-box">${escapeHtml(doc.number)}</td>
        <td class="ks2-num-box">${escapeHtml(dateRu)}</td>
        <td class="ks2-num-box">с ${escapeHtml(formatDateRu(doc.periodStart))}</td>
        <td class="ks2-num-box">по ${escapeHtml(formatDateRu(doc.periodEnd))}</td>
      </tr>
    </table>
  </div>

  <div style="font-size:10pt; margin-bottom:6px;">
    Сметная (договорная) стоимость в соответствии с договором подряда: <strong>${formatMoneyRu(doc.totalAmountRub)}</strong> руб.
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th rowspan="2" style="width:32px;">№ п/п</th>
        <th rowspan="2" style="width:62px;">№ поз. по смете</th>
        <th rowspan="2">Наименование работ</th>
        <th rowspan="2" style="width:68px;">№ единичной расценки</th>
        <th rowspan="2" style="width:52px;">Ед. изм.</th>
        <th colspan="3">Выполнено работ</th>
      </tr>
      <tr>
        <th style="width:64px;">количество</th>
        <th style="width:78px;">цена за ед., ₽</th>
        <th style="width:92px;">стоимость, ₽</th>
      </tr>
      <tr style="font-size:8.5pt;background:#f9fafb;">
        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td class="text-center">1.1</td>
        <td>
          ${escapeHtml(doc.workDescription)}<br/>
          <span style="font-size:9pt;color:#374151;">Техника: ${escapeHtml(doc.equipmentName)} · Машинист: ${escapeHtml(doc.operatorName)}</span>
        </td>
        <td class="text-center">ГЭСН-М</td>
        <td class="text-center">${escapeHtml(doc.unitLabel)}</td>
        <td class="text-right">${doc.quantity}</td>
        <td class="text-right">${formatMoneyRu(doc.rateRub)}</td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
      </tr>
      <tr>
        <td colspan="7" class="text-right"><strong>Итого по акту:</strong></td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
      </tr>
      <tr>
        <td colspan="7" class="text-right">${req.hasVat ? 'В том числе НДС 20%:' : 'Без налога (НДС) по УСН:'}</td>
        <td class="text-right">${req.hasVat ? formatMoneyRu(vatAmount) : '—'}</td>
      </tr>
      <tr>
        <td colspan="7" class="text-right"><strong>Всего по акту:</strong></td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="words-summary">
    Итого стоимость выполненных работ по акту КС-2: <strong>${formatMoneyRu(doc.totalAmountRub)} руб.</strong> (${escapeHtml(words)}).
  </div>

  <div class="signatures">
    <div>
      <strong>Сдал (Подрядчик):</strong><br/>
      ${escapeHtml(req.directorTitle)} (${escapeHtml(req.shortName)})
      <div class="sign-block">
        _________________ / ${escapeHtml(req.directorFio)} /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
    <div>
      <strong>Принял (Заказчик):</strong><br/>
      Представитель ${escapeHtml(doc.clientName)}
      <div class="sign-block">
        _________________ / _________________ /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateNormativeKs3Html(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): string {
  const req = getSubjectRequisites(doc.accountingSubject, oneCConfig, branch);
  const vatAmount = calculateVatRub(doc.totalAmountRub, doc.accountingSubject);
  const baseWithoutVat = doc.totalAmountRub - vatAmount;
  const dateRu = formatDateRu(doc.date);
  const words = amountToRussianWords(doc.totalAmountRub);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>КС-3 № ${escapeHtml(doc.number)}</title>
  <style>
    ${COMMON_A4_PRINT_CSS}
    .ks3-top-stamp {
      text-align: right;
      font-size: 8.5pt;
      line-height: 1.25;
      margin-bottom: 6px;
    }
    .ks3-codes-table {
      width: auto;
      margin-left: auto;
      margin-bottom: 6px;
    }
    .ks3-codes-table td {
      border: 1px solid #111827;
      padding: 2px 8px;
      font-size: 9pt;
    }
    .ks3-header-table td {
      padding: 2px 4px;
      font-size: 9.5pt;
      vertical-align: bottom;
    }
    .ks3-underline {
      border-bottom: 1px solid #111827;
    }
    .ks3-num-box {
      border: 1px solid #111827;
      padding: 3px 6px;
      text-align: center;
      font-weight: 700;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>
  <div class="ks3-top-stamp">
    Унифицированная форма № КС-3<br/>
    Утверждена постановлением Госкомстата России от 11.11.99 № 100
  </div>

  <table class="ks3-codes-table">
    <tr>
      <td></td>
      <td class="text-center"><strong>Код</strong></td>
    </tr>
    <tr>
      <td>Форма по ОКУД</td>
      <td class="text-center"><strong>0322001</strong></td>
    </tr>
    <tr>
      <td>по ОКПО</td>
      <td class="text-center">${escapeHtml(req.okpo)}</td>
    </tr>
  </table>

  <table class="ks3-header-table">
    <tr>
      <td style="width:140px;">Инвестор:</td>
      <td class="ks3-underline">${escapeHtml(doc.clientName)}</td>
    </tr>
    <tr>
      <td>Заказчик (Генподрядчик):</td>
      <td class="ks3-underline"><strong>${escapeHtml(doc.clientName)}</strong>${doc.clientInn ? `, ИНН ${escapeHtml(doc.clientInn)}` : ''}</td>
    </tr>
    <tr>
      <td>Подрядчик (Исполнитель):</td>
      <td class="ks3-underline"><strong>${escapeHtml(req.fullName)}</strong>, ИНН ${escapeHtml(req.inn)}${req.kpp !== '—' ? ` / КПП ${escapeHtml(req.kpp)}` : ''}</td>
    </tr>
    <tr>
      <td>Стройка / Объект:</td>
      <td class="ks3-underline">${escapeHtml(doc.siteAddress)} · Участок: ${escapeHtml(branch?.name || 'Головной')}</td>
    </tr>
    <tr>
      <td>Договор подряда (заказ):</td>
      <td class="ks3-underline">№ ${escapeHtml(doc.orderOrDealNumber)}</td>
    </tr>
  </table>

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin: 10px 0 8px;">
    <div style="font-size:11.5pt; font-weight:700; text-transform:uppercase;">
      СПРАВКА О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ И ЗАТРАТ
    </div>
    <table style="width:auto;">
      <tr>
        <td class="ks3-num-box">Номер документа</td>
        <td class="ks3-num-box">Дата составления</td>
        <td class="ks3-num-box" colspan="2">Отчётный период</td>
      </tr>
      <tr>
        <td class="ks3-num-box">${escapeHtml(doc.number)}</td>
        <td class="ks3-num-box">${escapeHtml(dateRu)}</td>
        <td class="ks3-num-box">с ${escapeHtml(formatDateRu(doc.periodStart))}</td>
        <td class="ks3-num-box">по ${escapeHtml(formatDateRu(doc.periodEnd))}</td>
      </tr>
    </table>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th rowspan="2" style="width:36px;">№ п/п</th>
        <th rowspan="2">Наименование пусковых комплексов, этапов, объектов, видов выполненных работ, затрат</th>
        <th rowspan="2" style="width:68px;">Код</th>
        <th colspan="3">Стоимость выполненных работ и затрат, руб.</th>
      </tr>
      <tr>
        <th style="width:105px;">с начала проведения работ</th>
        <th style="width:105px;">с начала года</th>
        <th style="width:110px;">в том числе за отчётный период</th>
      </tr>
      <tr style="font-size:8.5pt;background:#f9fafb;">
        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td>
          <strong>Всего работ и затрат, включаемых в стоимость работ</strong><br/>
          ${escapeHtml(doc.workDescription)} (${doc.quantity} ${escapeHtml(doc.unitLabel)} × ${formatMoneyRu(doc.rateRub)} ₽)<br/>
          <span style="font-size:9pt;color:#374151;">Техника: ${escapeHtml(doc.equipmentName)} · Машинист: ${escapeHtml(doc.operatorName)}</span>
        </td>
        <td class="text-center">КС-3</td>
        <td class="text-right">${formatMoneyRu(baseWithoutVat)}</td>
        <td class="text-right">${formatMoneyRu(baseWithoutVat)}</td>
        <td class="text-right"><strong>${formatMoneyRu(baseWithoutVat)}</strong></td>
      </tr>
      <tr>
        <td colspan="3" class="text-right">Итого без НДС:</td>
        <td class="text-right">${formatMoneyRu(baseWithoutVat)}</td>
        <td class="text-right">${formatMoneyRu(baseWithoutVat)}</td>
        <td class="text-right">${formatMoneyRu(baseWithoutVat)}</td>
      </tr>
      <tr>
        <td colspan="3" class="text-right">${req.hasVat ? 'Сумма НДС (20%):' : 'НДС (УСН — без НДС):'}</td>
        <td class="text-right">${req.hasVat ? formatMoneyRu(vatAmount) : '—'}</td>
        <td class="text-right">${req.hasVat ? formatMoneyRu(vatAmount) : '—'}</td>
        <td class="text-right">${req.hasVat ? formatMoneyRu(vatAmount) : '—'}</td>
      </tr>
      <tr>
        <td colspan="3" class="text-right"><strong>Всего с учётом НДС:</strong></td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="words-summary">
    Итого стоимость выполненных работ и затрат за отчётный период по справке КС-3: <strong>${formatMoneyRu(doc.totalAmountRub)} руб.</strong> (${escapeHtml(words)}).
  </div>

  <div class="signatures">
    <div>
      <strong>Подрядчик (Исполнитель):</strong><br/>
      ${escapeHtml(req.directorTitle)} (${escapeHtml(req.shortName)})
      <div class="sign-block">
        _________________ / ${escapeHtml(req.directorFio)} /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
    <div>
      <strong>Заказчик (Генподрядчик):</strong><br/>
      Представитель ${escapeHtml(doc.clientName)}
      <div class="sign-block">
        _________________ / _________________ /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateNormativeInvoiceHtml(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): string {
  const req = getSubjectRequisites(doc.accountingSubject, oneCConfig, branch);
  const vatAmount = calculateVatRub(doc.totalAmountRub, doc.accountingSubject);
  const dateRu = formatDateRu(doc.date);
  const words = amountToRussianWords(doc.totalAmountRub);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Счёт на оплату № ${escapeHtml(doc.number)}</title>
  <style>
    ${COMMON_A4_PRINT_CSS}
    .bank-table td {
      border: 1px solid #111827;
      padding: 4px 6px;
      font-size: 9.5pt;
      vertical-align: top;
    }
    .bank-caption {
      font-size: 8pt;
      color: #4b5563;
      display: block;
      margin-top: 4px;
    }
    .invoice-note {
      margin-top: 10px;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>
  <div style="font-size:8.5pt; text-align:center; margin-bottom:4px; color:#374151;">
    Внимание! Оплата данного счёта означает согласие с условиями оказания услуг спецтехники.
  </div>

  <table class="bank-table">
    <tr>
      <td colspan="2" rowspan="2" style="width:55%;">
        ${escapeHtml(req.bankName)}
        <span class="bank-caption">Банк получателя</span>
      </td>
      <td style="width:12%;">БИК</td>
      <td style="width:33%;">${escapeHtml(req.bik)}</td>
    </tr>
    <tr>
      <td>Сч. №</td>
      <td>${escapeHtml(req.corrAccount)}</td>
    </tr>
    <tr>
      <td style="width:27%;">ИНН ${escapeHtml(req.inn)}</td>
      <td style="width:28%;">КПП ${escapeHtml(req.kpp)}</td>
      <td rowspan="2">Сч. №</td>
      <td rowspan="2"><strong>${escapeHtml(req.settlementAccount)}</strong></td>
    </tr>
    <tr>
      <td colspan="2">
        <strong>${escapeHtml(req.fullName)}</strong>
        <span class="bank-caption">Получатель</span>
      </td>
    </tr>
  </table>

  <div class="doc-title" style="margin-top:14px;">
    Счёт на оплату № ${escapeHtml(doc.number)} от ${escapeHtml(dateRu)} г.
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Поставщик (Исполнитель):</td>
      <td><strong>${escapeHtml(req.fullName)}</strong>, ИНН ${escapeHtml(req.inn)}${req.kpp !== '—' ? `, КПП ${escapeHtml(req.kpp)}` : ''}, ${escapeHtml(req.address)}</td>
    </tr>
    <tr>
      <td class="meta-label">Покупатель (Заказчик):</td>
      <td><strong>${escapeHtml(doc.clientName)}</strong>${doc.clientInn ? `, ИНН ${escapeHtml(doc.clientInn)}` : ''}${doc.clientAddress ? `, ${escapeHtml(doc.clientAddress)}` : ''}</td>
    </tr>
    <tr>
      <td class="meta-label">Основание:</td>
      <td>Договор / Заказ № ${escapeHtml(doc.orderOrDealNumber)} · Объект: ${escapeHtml(doc.siteAddress)} (${escapeHtml(formatDateRu(doc.periodStart))} — ${escapeHtml(formatDateRu(doc.periodEnd))})</td>
    </tr>
  </table>

  <table class="items-table" style="margin-top:10px;">
    <thead>
      <tr>
        <th style="width:36px;">№</th>
        <th>Товары (работы, услуги)</th>
        <th style="width:68px;">Кол-во</th>
        <th style="width:58px;">Ед.</th>
        <th style="width:92px;">Цена, ₽</th>
        <th style="width:104px;">Сумма, ₽</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td>
          ${escapeHtml(doc.workDescription)} (${escapeHtml(doc.equipmentName)}, экипаж: ${escapeHtml(doc.operatorName)})
        </td>
        <td class="text-right">${doc.quantity}</td>
        <td class="text-center">${escapeHtml(doc.unitLabel)}</td>
        <td class="text-right">${formatMoneyRu(doc.rateRub)}</td>
        <td class="text-right"><strong>${formatMoneyRu(doc.totalAmountRub)}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="totals-box">
    <div class="totals-row">
      <div class="totals-label">Итого:</div>
      <div class="totals-value">${formatMoneyRu(doc.totalAmountRub)} ₽</div>
    </div>
    <div class="totals-row">
      <div class="totals-label">${req.hasVat ? 'В том числе НДС (20%):' : 'Без налога (НДС):'}</div>
      <div class="totals-value">${req.hasVat ? `${formatMoneyRu(vatAmount)} ₽` : '—'}</div>
    </div>
    <div class="totals-row">
      <div class="totals-label">Всего к оплате:</div>
      <div class="totals-value">${formatMoneyRu(doc.totalAmountRub)} ₽</div>
    </div>
  </div>

  <div class="words-summary">
    Всего наименований 1, на сумму <strong>${formatMoneyRu(doc.totalAmountRub)} руб.</strong><br/>
    <strong>${escapeHtml(words)}</strong>
  </div>

  <div class="invoice-note">
    Оплатить в течение 5 банковских дней с даты выставления счёта. В назначении платежа просим указать:
    «Оплата по счёту № ${escapeHtml(doc.number)} от ${escapeHtml(dateRu)} по заказу ${escapeHtml(doc.orderOrDealNumber)}. ${escapeHtml(req.vatNote)}».
  </div>

  <div class="signatures">
    <div>
      <strong>${escapeHtml(req.directorTitle)}</strong>
      <div class="sign-block">
        _________________ / ${escapeHtml(req.directorFio)} /
      </div>
      <div class="stamp-note">М.П.</div>
    </div>
    <div>
      <strong>Главный бухгалтер</strong>
      <div class="sign-block">
        _________________ / ${escapeHtml(req.accountantFio)} /
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function generateClosingDocHtml(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): string {
  if (doc.kind === 'ks2') return generateNormativeKs2Html(doc, branch, oneCConfig);
  if (doc.kind === 'ks3') return generateNormativeKs3Html(doc, branch, oneCConfig);
  if (doc.kind === 'invoice') return generateNormativeInvoiceHtml(doc, branch, oneCConfig);
  return generateNormativeActHtml(doc, branch, oneCConfig);
}

export function generateClosingDocPlainText(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): string {
  const req = getSubjectRequisites(doc.accountingSubject, oneCConfig, branch);
  const vatAmount = calculateVatRub(doc.totalAmountRub, doc.accountingSubject);
  const words = amountToRussianWords(doc.totalAmountRub);
  const titleMap: Record<ClosingDocKind, string> = {
    act_services: `АКТ СДАЧИ-ПРИЁМКИ ОКАЗАННЫХ УСЛУГ № ${doc.number} от ${formatDateRu(doc.date)}`,
    ks2: `АКТ О ПРИЁМКЕ ВЫПОЛНЕННЫХ РАБОТ (Унифицированная форма № КС-2, ОКУД 0322005) № ${doc.number} от ${formatDateRu(doc.date)}`,
    ks3: `СПРАВКА О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ И ЗАТРАТ (Унифицированная форма № КС-3, ОКУД 0322001) № ${doc.number} от ${formatDateRu(doc.date)}`,
    invoice: `СЧЁТ НА ОПЛАТУ УСЛУГ № ${doc.number} от ${formatDateRu(doc.date)}`
  };

  return [
    titleMap[doc.kind],
    `Участок: ${branch?.name || 'Головной участок'}`,
    `Исполнитель (Поставщик/Подрядчик): ${req.fullName} (ИНН ${req.inn}${req.kpp !== '—' ? `, КПП ${req.kpp}` : ''})`,
    `Банк: ${req.bankName}, БИК ${req.bik}, р/с ${req.settlementAccount}, к/с ${req.corrAccount}`,
    `Заказчик (Покупатель): ${doc.clientName}`,
    `Основание: Заказ/Договор № ${doc.orderOrDealNumber}`,
    `Объект производства работ: ${doc.siteAddress}`,
    `Отчётный период: с ${formatDateRu(doc.periodStart)} по ${formatDateRu(doc.periodEnd)}`,
    '',
    `1. ${doc.workDescription}`,
    `   Техника: ${doc.equipmentName} | Машинист: ${doc.operatorName}`,
    `   Объём: ${doc.quantity} ${doc.unitLabel} × ${formatMoneyRu(doc.rateRub)} ₽ = ${formatMoneyRu(doc.totalAmountRub)} ₽`,
    '',
    `Итого: ${formatMoneyRu(doc.totalAmountRub)} ₽`,
    req.hasVat ? `В т.ч. НДС 20%: ${formatMoneyRu(vatAmount)} ₽` : req.vatNote,
    `Сумма прописью: ${words}`,
    '',
    `Подпись Исполнителя: ${req.directorTitle} ${req.directorFio}`,
    `Подпись Заказчика: ________________________`
  ].join('\n');
}

export function printClosingDocumentHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.srcdoc = html;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2500);
    }
  };
  document.body.appendChild(iframe);
}

export async function downloadClosingDocx(
  doc: ClosingDocumentRecord,
  branch: FleetBranch | null | undefined,
  oneCConfig: OneCIntegrationConfig
): Promise<void> {
  const plain = generateClosingDocPlainText(doc, branch, oneCConfig);
  const lines = plain.split(/\r?\n/);
  const wordDoc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: lines[0] || CLOSING_DOC_KIND_LABELS[doc.kind],
                bold: true,
                font: 'Times New Roman',
                size: 26
              })
            ]
          }),
          ...lines.slice(1).map(
            line =>
              new Paragraph({
                spacing: { after: 70 },
                children: [
                  new TextRun({
                    text: line,
                    font: 'Times New Roman',
                    size: 22
                  })
                ]
              })
          )
        ]
      }
    ]
  });
  const blob = await Packer.toBlob(wordDoc);
  const safeName = doc.number.replace(/[/\\:*?"<>|]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
