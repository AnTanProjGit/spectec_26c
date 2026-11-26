import {
  AccountingSubjectId,
  ClientType,
  OneCIntegrationConfig,
  OneCRoutingRules
} from '../types';

export const defaultOneCConfig: OneCIntegrationConfig = {
  subjects: {
    ip_specialtechnica: {
      id: 'ip_specialtechnica',
      entityName: 'ИП «SpecialTechnica»',
      shortName: 'ИП SpecialTechnica',
      taxSystem: 'УСН 6% (без НДС)',
      inn: '772845190312',
      odataUrl: 'https://1c.specialtechnica.ru/ip_st/odata/standard.odata',
      apiLogin: 'api_erp_ip_specialtechnica',
      apiSecret: '',
      exchangeFormat: 'odata_v3',
      autoSyncDocs: true,
      enabled: true,
      connectionStatus: 'connected',
      lastCheckedAt: '2026-11-16 09:40'
    },
    ooo_specialtech: {
      id: 'ooo_specialtech',
      entityName: 'ООО «SpecialTech»',
      shortName: 'ООО SpecialTech',
      taxSystem: 'ОСНО (с НДС 20%)',
      inn: '7709482154',
      odataUrl: 'https://1c.specialtech.ru/ooo_st/odata/standard.odata',
      apiLogin: 'api_erp_ooo_specialtech',
      apiSecret: '',
      exchangeFormat: 'odata_v3',
      autoSyncDocs: true,
      enabled: true,
      connectionStatus: 'connected',
      lastCheckedAt: '2026-11-16 09:42'
    }
  },
  routing: {
    legalEntityTarget: 'ooo_specialtech',
    individualWithContractTarget: 'ip_specialtechnica',
    individualWithoutContractTarget: 'ip_specialtechnica',
    allowIndividualWithoutContract: true,
    requireContractForLegalEntity: true
  }
};

export interface RoutingResolution {
  subjectId: AccountingSubjectId;
  reason: string;
  documentPackage: string[];
}

export function resolveAccountingSubject(
  clientType: ClientType,
  hasContract: boolean,
  routing: OneCRoutingRules
): RoutingResolution {
  if (clientType === 'legal_entity') {
    const subjectId = routing.legalEntityTarget;
    return {
      subjectId,
      reason: 'Юридическое лицо — работа строго на основании договора (счёт, УПД/КС-2, ЭСМ-7, ЭДО).',
      documentPackage: ['Договор аренды спецтехники', 'Счёт на оплату', 'УПД / Акт КС-2', 'ЭСМ-7']
    };
  }

  if (hasContract) {
    const subjectId = routing.individualWithContractTarget;
    return {
      subjectId,
      reason: 'Физическое лицо с письменным договором — проведение через выбранный по правилу субъект 1С.',
      documentPackage: ['Договор аренды с ФЛ', 'Акт выполненных работ', 'Чек ККТ (54-ФЗ) / ПП', 'ЭСМ-7']
    };
  }

  const subjectId = routing.individualWithoutContractTarget;
  return {
    subjectId,
    reason: 'Физическое лицо без договора — упрощённая схема (оферта / СБП / онлайн-чек 54-ФЗ без бумажного договора).',
    documentPackage: ['Счёт-оферта / Заказ-наряд', 'Чек ККТ 54-ФЗ / СБП', 'Электронный рапорт ЭСМ-7']
  };
}
