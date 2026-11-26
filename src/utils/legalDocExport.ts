import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import { LegalDocKind, LegalDocStatus, LegalDocument } from '../types';

export type SingleDocExportFormat = 'docx' | 'pdf' | 'xlsx' | 'txt' | 'html' | 'json';

export const KIND_LABELS: Record<LegalDocKind, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  dispute: 'Спор',
  claim: 'Претензия',
  template: 'Шаблон'
};

export const STATUS_LABELS: Record<LegalDocStatus, string> = {
  draft: 'Черновик',
  review: 'На согласовании',
  active: 'Действует',
  dispute: 'В споре / Претензия',
  resolved: 'Урегулирован',
  archived: 'Архив'
};

export function anonymizeLegalText(text: string, counterparty?: string): string {
  let result = text;

  if (counterparty && counterparty.trim().length > 2 && !counterparty.startsWith('Типовой')) {
    const escaped = counterparty.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '[КОНТРАГЕНТ]');
  }

  result = result
    .replace(/\bИНН\s*:?\s*\d{10,12}\b/gi, 'ИНН [СКРЫТО]')
    .replace(/\bКПП\s*:?\s*\d{9}\b/gi, 'КПП [СКРЫТО]')
    .replace(/\bОГРНИП\s*:?\s*\d{15}\b/gi, 'ОГРНИП [СКРЫТО]')
    .replace(/\bОГРН\s*:?\s*\d{13,15}\b/gi, 'ОГРН [СКРЫТО]')
    .replace(/\bр\/с\s*:?\s*\d{20}\b/gi, 'р/с [СКРЫТО]')
    .replace(/\bк\/с\s*:?\s*\d{20}\b/gi, 'к/с [СКРЫТО]')
    .replace(/\bБИК\s*:?\s*\d{9}\b/gi, 'БИК [СКРЫТО]')
    .replace(/серия\s+\d{4}\s+№\s*\d{6}/gi, 'серия [XXXX] № [XXXXXX]')
    .replace(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, '[ТЕЛЕФОН СКРЫТ]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL СКРЫТ]');

  return result;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'document';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prepareDocumentForExport(
  doc: LegalDocument,
  anonymize: boolean
): LegalDocument {
  if (!anonymize) return doc;
  return {
    ...doc,
    counterparty: doc.kind === 'template' ? doc.counterparty : '[КОНТРАГЕНТ СКРЫТ]',
    content: anonymizeLegalText(doc.content, doc.counterparty),
    disputeReason: doc.disputeReason
      ? anonymizeLegalText(doc.disputeReason, doc.counterparty)
      : undefined
  };
}

function buildPrintableHtml(
  doc: LegalDocument,
  branchName: string,
  includeMetadata: boolean
): string {
  const subjectLabel =
    doc.accountingSubject === 'ip_specialtechnica'
      ? 'ИП «SpecialTechnica»'
      : 'ООО «SpecialTech»';

  const lines = doc.content.split(/\r?\n/).map(line =>
    line.trim() === ''
      ? '<div class="spacer"></div>'
      : `<p class="body-line">${escapeHtml(line)}</p>`
  );

  const metaSection = includeMetadata
    ? `<div class="meta-box">
    <div class="meta-title">${escapeHtml(doc.number)} — ${escapeHtml(doc.title)}</div>
    <div class="meta-grid">
      <div><strong>Вид:</strong> ${escapeHtml(KIND_LABELS[doc.kind])}</div>
      <div><strong>Дата документа:</strong> ${escapeHtml(doc.createdAt)}</div>
      <div><strong>Контрагент:</strong> ${escapeHtml(doc.counterparty)}</div>
      <div><strong>Статус:</strong> ${escapeHtml(STATUS_LABELS[doc.status])}</div>
      <div><strong>Участок:</strong> ${escapeHtml(branchName)}</div>
      <div><strong>Субъект 1С:</strong> ${escapeHtml(subjectLabel)}</div>
      ${doc.amountRub > 0 ? `<div><strong>Сумма:</strong> ${doc.amountRub.toLocaleString('ru-RU')} ₽</div>` : ''}
      ${doc.disputeAmountRub ? `<div><strong>Сумма спора:</strong> ${doc.disputeAmountRub.toLocaleString('ru-RU')} ₽</div>` : ''}
    </div>
  </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(doc.number)} — ${escapeHtml(doc.title)}</title>
  <style>
    @page { size: A4; margin: 18mm 18mm 18mm 20mm; }
    body {
      font-family: "Times New Roman", Georgia, serif;
      color: #111827;
      font-size: 11.5pt;
      line-height: 1.45;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 10px 14px;
      margin-bottom: 18px;
      font-family: Arial, sans-serif;
      font-size: 9.5pt;
    }
    .meta-title {
      font-size: 12pt;
      font-weight: 700;
      margin: 0 0 6px 0;
      color: #0f172a;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
      color: #334155;
    }
    .body-line {
      margin: 0 0 4px 0;
      white-space: pre-wrap;
    }
    .spacer {
      height: 8px;
    }
    @media print {
      body { padding: 0; }
      .meta-box { break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${metaSection}
  <div class="content">
    ${lines.join('\n')}
  </div>
</body>
</html>`;
}

function buildDocxParagraphsForDocument(
  doc: LegalDocument,
  branchName: string,
  includeMetadata: boolean
): Paragraph[] {
  const subjectLabel =
    doc.accountingSubject === 'ip_specialtechnica'
      ? 'ИП «SpecialTechnica»'
      : 'ООО «SpecialTech»';

  const paragraphs: Paragraph[] = [];

  if (includeMetadata) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `${doc.number} — ${doc.title}`,
            bold: true,
            font: 'Times New Roman',
            size: 26
          })
        ]
      }),
      new Paragraph({
        spacing: { after: 160 },
        border: {
          bottom: {
            color: '94A3B8',
            space: 6,
            style: BorderStyle.SINGLE,
            size: 6
          }
        },
        children: [
          new TextRun({
            text: `Вид: ${KIND_LABELS[doc.kind]}  |  Дата: ${doc.createdAt}  |  Контрагент: ${doc.counterparty}  |  Участок: ${branchName}  |  Субъект 1С: ${subjectLabel}  |  Статус: ${STATUS_LABELS[doc.status]}${
              doc.amountRub > 0 ? `  |  Сумма: ${doc.amountRub.toLocaleString('ru-RU')} ₽` : ''
            }${doc.disputeAmountRub ? `  |  Спор: ${doc.disputeAmountRub.toLocaleString('ru-RU')} ₽` : ''}`,
            font: 'Arial',
            size: 18,
            color: '475569'
          })
        ]
      })
    );

    if (doc.disputeReason) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `Основание спора / претензии: ${doc.disputeReason}`,
              bold: true,
              font: 'Times New Roman',
              size: 22
            })
          ]
        })
      );
    }
  }

  doc.content.split(/\r?\n/).forEach(line => {
    paragraphs.push(
      new Paragraph({
        spacing: { after: line.trim() === '' ? 100 : 60, line: 276 },
        children: [
          new TextRun({
            text: line,
            font: 'Times New Roman',
            size: 22
          })
        ]
      })
    );
  });

  return paragraphs;
}

export async function exportSingleLegalDoc(
  rawDoc: LegalDocument,
  format: SingleDocExportFormat,
  branchName: string,
  options?: {
    includeMetadata?: boolean;
    anonymize?: boolean;
  }
): Promise<void> {
  const includeMetadata = options?.includeMetadata ?? true;
  const anonymize = options?.anonymize ?? false;
  const doc = prepareDocumentForExport(rawDoc, anonymize);
  const baseName = `${sanitizeFileName(doc.number)}${anonymize ? '_обезличенный' : ''}`;
  const subjectLabel =
    doc.accountingSubject === 'ip_specialtechnica'
      ? 'ИП SpecialTechnica'
      : 'ООО SpecialTech';

  if (format === 'txt') {
    const headerLines = includeMetadata
      ? [
          `${doc.number} — ${doc.title}`,
          `Дата: ${doc.createdAt} | Вид: ${KIND_LABELS[doc.kind]} | Статус: ${STATUS_LABELS[doc.status]}`,
          `Контрагент: ${doc.counterparty} | Участок: ${branchName} | Субъект 1С: ${subjectLabel}`,
          doc.amountRub > 0 ? `Сумма: ${doc.amountRub.toLocaleString('ru-RU')} ₽` : '',
          doc.disputeAmountRub ? `Сумма спора: ${doc.disputeAmountRub.toLocaleString('ru-RU')} ₽` : '',
          doc.disputeReason ? `Основание спора: ${doc.disputeReason}` : '',
          ''
        ].filter((l, idx) => idx >= 6 || l !== '')
      : [];

    const text = [...headerLines, doc.content].join('\n');
    triggerBlobDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`);
    return;
  }

  if (format === 'html') {
    const html = buildPrintableHtml(doc, branchName, includeMetadata);
    triggerBlobDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `${baseName}.html`);
    return;
  }

  if (format === 'json') {
    const json = JSON.stringify(doc, null, 2);
    triggerBlobDownload(new Blob([json], { type: 'application/json;charset=utf-8' }), `${baseName}.json`);
    return;
  }

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    if (includeMetadata) {
      const cardRows = [
        { Поле: 'Номер документа', Значение: doc.number },
        { Поле: 'Наименование', Значение: doc.title },
        { Поле: 'Вид', Значение: KIND_LABELS[doc.kind] },
        { Поле: 'Дата документа', Значение: doc.createdAt },
        { Поле: 'Обновлён', Значение: doc.updatedAt },
        { Поле: 'Контрагент', Значение: doc.counterparty },
        { Поле: 'Участок', Значение: branchName },
        { Поле: 'Субъект 1С', Значение: subjectLabel },
        { Поле: 'Статус', Значение: STATUS_LABELS[doc.status] },
        { Поле: 'Сумма (₽)', Значение: doc.amountRub },
        { Поле: 'Сумма спора (₽)', Значение: doc.disputeAmountRub || 0 },
        { Поле: 'Основание спора', Значение: doc.disputeReason || '' },
        { Поле: 'Ответственный', Значение: doc.authorName }
      ];
      const wsCard = XLSX.utils.json_to_sheet(cardRows);
      wsCard['!cols'] = [{ wch: 24 }, { wch: 64 }];
      XLSX.utils.book_append_sheet(wb, wsCard, 'Карточка');
    }

    const textRows = doc.content.split(/\r?\n/).map((line, i) => ({
      '№ строки': i + 1,
      'Текст документа': line
    }));
    const wsText = XLSX.utils.json_to_sheet(textRows);
    wsText['!cols'] = [{ wch: 10 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsText, 'Текст документа');

    XLSX.writeFile(wb, `${baseName}.xlsx`);
    return;
  }

  if (format === 'docx') {
    const wordDoc = new Document({
      sections: [
        {
          properties: {},
          children: buildDocxParagraphsForDocument(doc, branchName, includeMetadata)
        }
      ]
    });
    const blob = await Packer.toBlob(wordDoc);
    triggerBlobDownload(blob, `${baseName}.docx`);
    return;
  }

  if (format === 'pdf') {
    const html = buildPrintableHtml(doc, branchName, includeMetadata);
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
        }, 2000);
      }
    };
    document.body.appendChild(iframe);
  }
}
