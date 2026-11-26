/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { FleetView } from './components/views/FleetView';
import { RentalsView } from './components/views/RentalsView';
import { CrmView } from './components/views/CrmView';
import { TimesheetsView } from './components/views/TimesheetsView';
import { AiAnalystView } from './components/views/AiAnalystView';
import { KnowledgeBaseView } from './components/views/KnowledgeBaseView';
import { Integrations1CView } from './components/views/Integrations1CView';
import { BranchesView } from './components/views/BranchesView';
import { ChatView, CustomerChatTarget } from './components/views/ChatView';
import { AdminPanelView } from './components/views/AdminPanelView';
import { FleetManagerView } from './components/views/FleetManagerView';
import { ContractsView, LawyerTab } from './components/views/ContractsView';

import { QuickShiftModal } from './components/QuickShiftModal';
import { NewDealModal } from './components/NewDealModal';
import { EquipmentDetailModal } from './components/EquipmentDetailModal';
import { ExcelExchangeModal } from './components/ExcelExchangeModal';
import { ClosingDocsModal, ClosingModalTarget } from './components/ClosingDocsModal';
import { StatusNotificationSettingsModal } from './components/StatusNotificationSettingsModal';

import { 
  initialBranches,
  initialEquipmentList, 
  initialCRMDeals, 
  initialRentalOrders, 
  initialShiftReports, 
  initialAnomalies,
  initialKnowledgeDocs,
  initialChatMessages,
  initialDrivers,
  initialLegalDocuments,
  initialLegalHistory
} from './data/seedData';
import {
  AccountingSubjectId,
  AnomalyAlert,
  Equipment,
  ShiftReport,
  CRMDeal,
  CRMStage,
  RentalOrder,
  OneCIntegrationConfig,
  FleetBranch,
  ChatAttachment,
  ChatConfirmation,
  ChatMessage,
  DriverProfile,
  DriverReplacementRecord,
  MaxCustomerBotConfig,
  KnowledgeDoc,
  LegalDocument,
  LegalHistoryEntry,
  LegalRole,
  SystemAdminConfig,
  ClosingDocumentRecord,
  InvoiceStatus,
  StatusNotificationItem,
  StatusNotificationSettings
} from './types';
import { defaultOneCConfig } from './utils/accounting1c';
import { defaultSystemAdminConfig, mergeAdminConfig } from './utils/adminConfig';
import { anonymizeLegalText } from './utils/legalDocExport';
import { getBranchFixedOverheads } from './utils/branchOverheads';
import {
  CLOSING_DOC_KIND_LABELS,
  DEFAULT_STATUS_NOTIFICATION_SETTINGS,
  INVOICE_STATUS_META,
  deriveActServicesPrefix,
  generateClosingDocPlainText,
  getActServicesPrefix,
  getKs2Prefix
} from './utils/closingDocuments';
import { CLIENT_ORG_DIRECTORY } from './utils/clientDirectory';

function replaceLeadingPrefix(
  value: string,
  oldPrefix: string,
  newPrefix: string
): string {
  if (!value || !oldPrefix || !newPrefix || oldPrefix === newPrefix) return value;
  if (value.startsWith(oldPrefix)) {
    return `${newPrefix}${value.slice(oldPrefix.length)}`;
  }
  return value;
}

function loadSavedBranches(): FleetBranch[] {
  try {
    const saved = localStorage.getItem('specialtech_branches');
    if (saved) {
      const parsed = JSON.parse(saved) as FleetBranch[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const needsBackfill = !localStorage.getItem('specialtech_overheads_leasing_taxes_v1');
        const needsCleanMerge = !localStorage.getItem('specialtech_overheads_clean_v3');
        const legacySeedSalaryIds = new Set([
          'ovh-acc-hq',
          'ovh-fm-hq',
          'ovh-mech-hq',
          'ovh-acc-kzn',
          'ovh-fm-kzn',
          'ovh-mech-kzn'
        ]);

        const migrated = parsed.map(branch => {
          const normalized = getBranchFixedOverheads(branch);
          let nextItems = [...normalized];

          if (needsBackfill) {
            const seedBranch = initialBranches.find(b => b.id === branch.id);
            const fallbackItems = seedBranch?.fixedOverheads ?? [];
            if (!nextItems.some(i => i.category === 'leasing')) {
              const seedLeasing = fallbackItems.find(i => i.category === 'leasing');
              if (seedLeasing) nextItems.push(seedLeasing);
            }
            if (!nextItems.some(i => i.category === 'taxes')) {
              const seedTaxes = fallbackItems.find(i => i.category === 'taxes');
              if (seedTaxes) nextItems.push(seedTaxes);
            }
          }

          if (needsCleanMerge) {
            const hasLegacySplit = nextItems.some(i => legacySeedSalaryIds.has(i.id));
            if (hasLegacySplit) {
              const mergedSalaryAmount = nextItems
                .filter(i => legacySeedSalaryIds.has(i.id))
                .reduce((s, i) => s + (Number(i.monthlyAmountRub) || 0), 0);
              const others = nextItems.filter(i => !legacySeedSalaryIds.has(i.id));
              nextItems = [
                {
                  id: branch.isHeadquarters ? 'ovh-sal-hq' : `ovh-sal-${branch.code.toLowerCase()}`,
                  category: 'office_itr_salary',
                  name: 'Зарплата офис и ИТР (Fleet Manager, ИТР, бухгалтерия)',
                  monthlyAmountRub: mergedSalaryAmount
                },
                ...others
              ];
            }
          }

          const seedBranch = initialBranches.find(b => b.id === branch.id);
          const cleanCode = (branch.code || seedBranch?.code || 'FIL').trim().toUpperCase();
          const fallbackFlow = seedBranch?.documentFlow || {
            isolatedStreams: true,
            isolateCrmAndErp: true,
            orderPrefix: `RO-${cleanCode}-`,
            waybillPrefix: `ПЛ-${cleanCode}-`,
            shiftPrefix: `SH-${cleanCode}-`,
            actPrefix: `КС2-${cleanCode}-`,
            oneCDepartmentCode: `ПОДР-${cleanCode}-01`,
            default1CSubject: 'ooo_specialtech' as const
          };
          const rawFlow = branch.documentFlow || fallbackFlow;
          return {
            ...branch,
            code: cleanCode,
            documentFlow: {
              ...fallbackFlow,
              ...rawFlow,
              orderPrefix: rawFlow.orderPrefix?.trim() || fallbackFlow.orderPrefix,
              waybillPrefix: rawFlow.waybillPrefix?.trim() || fallbackFlow.waybillPrefix,
              shiftPrefix: rawFlow.shiftPrefix?.trim() || fallbackFlow.shiftPrefix,
              actPrefix: rawFlow.actPrefix?.trim() || fallbackFlow.actPrefix,
              oneCDepartmentCode:
                rawFlow.oneCDepartmentCode?.trim() || fallbackFlow.oneCDepartmentCode
            },
            fixedOverheads: nextItems
          };
        });

        if (needsBackfill) {
          localStorage.setItem('specialtech_overheads_leasing_taxes_v1', '1');
        }
        if (needsCleanMerge) {
          localStorage.setItem('specialtech_overheads_clean_v3', '1');
        }
        return migrated;
      }
    }
  } catch {
    // ignore storage errors
  }
  return initialBranches;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [branches, setBranches] = useState<FleetBranch[]>(loadSavedBranches);

  const [activeBranchId, setActiveBranchId] = useState<string | 'all'>(() => {
    try {
      const saved = localStorage.getItem('specialtech_active_branch');
      if (saved) return saved;
    } catch {
      // ignore storage errors
    }
    return initialBranches[0].id;
  });

  const [equipmentList, setEquipmentList] = useState<Equipment[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_equipment_list');
      if (saved) {
        const parsed = JSON.parse(saved) as Equipment[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seedMap = new Map(initialEquipmentList.map(e => [e.id, e]));
          return parsed.map(eq => {
            const seed = seedMap.get(eq.id);
            if (!seed) return eq;
            return {
              ...eq,
              mileageKmMonth: eq.mileageKmMonth ?? seed.mileageKmMonth,
              tripsMonth: eq.tripsMonth ?? seed.tripsMonth,
              subcontractCostMonth: eq.subcontractCostMonth ?? seed.subcontractCostMonth
            };
          });
        }
      }
    } catch {
      // ignore storage errors
    }
    return initialEquipmentList;
  });
  const CRM_COMPLETED_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

  const archiveExpiredCompletedDeals = (
    list: CRMDeal[],
    nowMs = Date.now()
  ): { next: CRMDeal[]; changed: boolean } => {
    let changed = false;
    const nowIso = new Date(nowMs).toISOString();
    const next = list.map(deal => {
      if (deal.stage === 'completed' && deal.debtAmount <= 0 && !deal.archivedAt) {
        const completedAt = deal.completedAt || deal.stageUpdatedAt || nowIso;
        const completedMs = Date.parse(completedAt);
        if (Number.isFinite(completedMs) && nowMs - completedMs >= CRM_COMPLETED_RETENTION_MS) {
          changed = true;
          return {
            ...deal,
            completedAt,
            archivedAt: nowIso
          };
        }
        if (!deal.completedAt) {
          changed = true;
          return {
            ...deal,
            completedAt
          };
        }
      }
      return deal;
    });
    return { next, changed };
  };

  const [deals, setDeals] = useState<CRMDeal[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_crm_deals');
      if (saved) {
        const parsed = JSON.parse(saved) as CRMDeal[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { next, changed } = archiveExpiredCompletedDeals(parsed);
          if (changed) {
            localStorage.setItem('specialtech_crm_deals', JSON.stringify(next));
          }
          return next;
        }
      }
    } catch {
      // ignore storage errors
    }
    return initialCRMDeals;
  });
  const [orders, setOrders] = useState<RentalOrder[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_rental_orders');
      if (saved) {
        const parsed = JSON.parse(saved) as RentalOrder[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    const currentBranches = loadSavedBranches();
    return initialRentalOrders.map(order => {
      const seedBranch = initialBranches.find(b => b.id === order.branchId);
      const currentBranch = currentBranches.find(b => b.id === order.branchId);
      if (!seedBranch || !currentBranch) return order;
      return {
        ...order,
        orderNumber: replaceLeadingPrefix(
          order.orderNumber,
          seedBranch.documentFlow.orderPrefix,
          currentBranch.documentFlow.orderPrefix
        )
      };
    });
  });

  const [closingDocs, setClosingDocs] = useState<ClosingDocumentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_closing_docs');
      if (saved) {
        const parsed = JSON.parse(saved) as ClosingDocumentRecord[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [notificationSettings, setNotificationSettings] =
    useState<StatusNotificationSettings>(() => {
      try {
        const saved = localStorage.getItem('specialtech_notification_settings');
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<StatusNotificationSettings>;
          return { ...DEFAULT_STATUS_NOTIFICATION_SETTINGS, ...parsed };
        }
      } catch {
        // ignore storage errors
      }
      return DEFAULT_STATUS_NOTIFICATION_SETTINGS;
    });

  const [statusNotifications, setStatusNotifications] = useState<
    StatusNotificationItem[]
  >(() => {
    try {
      const saved = localStorage.getItem('specialtech_status_notifications');
      if (saved) {
        const parsed = JSON.parse(saved) as StatusNotificationItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_shift_reports');
      if (saved) {
        const parsed = JSON.parse(saved) as ShiftReport[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    const currentBranches = loadSavedBranches();
    return initialShiftReports.map(shift => {
      const seedBranch = initialBranches.find(b => b.id === shift.branchId);
      const currentBranch = currentBranches.find(b => b.id === shift.branchId);
      if (!seedBranch || !currentBranch) return shift;
      return {
        ...shift,
        shiftNumber: replaceLeadingPrefix(
          shift.shiftNumber,
          seedBranch.documentFlow.shiftPrefix,
          currentBranch.documentFlow.shiftPrefix
        ),
        waybillNumber: shift.waybillNumber
          ? replaceLeadingPrefix(
              shift.waybillNumber,
              seedBranch.documentFlow.waybillPrefix,
              currentBranch.documentFlow.waybillPrefix
            )
          : undefined
      };
    });
  });
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_anomalies');
      if (saved) {
        const parsed = JSON.parse(saved) as AnomalyAlert[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    const currentBranches = loadSavedBranches();
    return initialAnomalies.map(anomaly => {
      const seedBranch = initialBranches.find(b => b.id === anomaly.branchId);
      const currentBranch = currentBranches.find(b => b.id === anomaly.branchId);
      if (
        !seedBranch ||
        !currentBranch ||
        seedBranch.documentFlow.shiftPrefix === currentBranch.documentFlow.shiftPrefix
      ) {
        return anomaly;
      }
      return {
        ...anomaly,
        title: anomaly.title
          .split(seedBranch.documentFlow.shiftPrefix)
          .join(currentBranch.documentFlow.shiftPrefix),
        description: anomaly.description
          .split(seedBranch.documentFlow.shiftPrefix)
          .join(currentBranch.documentFlow.shiftPrefix)
      };
    });
  });
  const [docs, setDocs] = useState<KnowledgeDoc[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_knowledge_docs');
      if (saved) {
        const parsed = JSON.parse(saved) as KnowledgeDoc[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seedMap = new Map(initialKnowledgeDocs.map(d => [d.id, d]));
          const upgraded = parsed.map(doc => {
            const seed = seedMap.get(doc.id);
            if (seed && doc.id === 'doc-5' && doc.fullText.length < 900) {
              return seed;
            }
            return doc;
          });
          const existingIds = new Set(upgraded.map(d => d.id));
          const missingSeeds = initialKnowledgeDocs.filter(d => !existingIds.has(d.id));
          return [...upgraded, ...missingSeeds];
        }
      }
    } catch {
      // ignore storage errors
    }
    return initialKnowledgeDocs;
  });
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_legal_docs');
      if (saved) {
        const parsed = JSON.parse(saved) as LegalDocument[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seedMap = new Map(initialLegalDocuments.map(d => [d.id, d]));
          const upgraded = parsed.map(doc => {
            const seed = seedMap.get(doc.id);
            if (seed && doc.content.length < 700) {
              return seed;
            }
            return doc;
          });
          const existingIds = new Set(upgraded.map(d => d.id));
          const missingSeeds = initialLegalDocuments.filter(d => !existingIds.has(d.id));
          return [...upgraded, ...missingSeeds];
        }
      }
    } catch {
      // ignore storage errors
    }
    return initialLegalDocuments;
  });
  const [legalHistory, setLegalHistory] = useState<LegalHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_legal_history');
      if (saved) {
        const parsed = JSON.parse(saved) as LegalHistoryEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return initialLegalHistory;
  });
  const [legalRole, setLegalRole] = useState<LegalRole>('lawyer');
  const [contractsTabRequest, setContractsTabRequest] = useState<{
    tab: LawyerTab;
    docCode?: string;
    nonce: number;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    const currentBranches = loadSavedBranches();
    return initialChatMessages.map(msg => {
      const seedBranch = initialBranches.find(b => b.id === msg.branchId);
      const currentBranch = currentBranches.find(b => b.id === msg.branchId);
      if (
        !seedBranch ||
        !currentBranch ||
        seedBranch.documentFlow.shiftPrefix === currentBranch.documentFlow.shiftPrefix
      ) {
        return msg;
      }
      return {
        ...msg,
        text: msg.text
          .split(seedBranch.documentFlow.shiftPrefix)
          .join(currentBranch.documentFlow.shiftPrefix)
      };
    });
  });
  const [adminConfirmationAllowed, setAdminConfirmationAllowed] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<DriverProfile[]>(() => {
    try {
      const saved = localStorage.getItem('specialtech_drivers');
      if (saved) {
        const parsed = JSON.parse(saved) as DriverProfile[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return initialDrivers;
  });
  const [driverReplacements, setDriverReplacements] = useState<Record<string, DriverReplacementRecord>>(() => {
    try {
      const saved = localStorage.getItem('specialtech_driver_replacements');
      if (saved) return JSON.parse(saved) as Record<string, DriverReplacementRecord>;
    } catch {
      // ignore storage errors
    }
    return {};
  });
  const [maxBotConfigs, setMaxBotConfigs] = useState<Record<string, MaxCustomerBotConfig>>(() => {
    try {
      const saved = localStorage.getItem('specialtech_max_client_bot_config');
      if (saved) return JSON.parse(saved) as Record<string, MaxCustomerBotConfig>;
    } catch {
      // ignore storage errors
    }
    return {};
  });
  const [oneCConfig, setOneCConfig] = useState<OneCIntegrationConfig>(() => {
    try {
      const saved = localStorage.getItem('specialtech_1c_config');
      if (saved) return JSON.parse(saved) as OneCIntegrationConfig;
    } catch {
      // ignore storage errors
    }
    return defaultOneCConfig;
  });

  const [adminConfig, setAdminConfig] = useState<SystemAdminConfig>(() => {
    try {
      const saved = localStorage.getItem('specialtech_admin_config');
      if (saved) {
        return mergeAdminConfig(JSON.parse(saved) as Partial<SystemAdminConfig>);
      }
    } catch {
      // ignore storage errors
    }
    return defaultSystemAdminConfig;
  });

  const handleUpdateEquipmentList = (nextList: Equipment[]) => {
    setEquipmentList(nextList);
    try {
      localStorage.setItem('specialtech_equipment_list', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const handleSaveAdminConfig = (nextConfig: SystemAdminConfig) => {
    setAdminConfig(nextConfig);
    try {
      localStorage.setItem('specialtech_admin_config', JSON.stringify(nextConfig));
    } catch {
      // ignore storage errors
    }
  };

  const handleSaveOneCConfig = (nextConfig: OneCIntegrationConfig) => {
    setOneCConfig(nextConfig);
    try {
      localStorage.setItem('specialtech_1c_config', JSON.stringify(nextConfig));
    } catch {
      // ignore storage errors
    }
  };

  const handleSelectBranch = (branchId: string | 'all') => {
    setActiveBranchId(branchId);
    try {
      localStorage.setItem('specialtech_active_branch', branchId);
    } catch {
      // ignore storage errors
    }
  };

  const persistEquipmentList = (nextList: Equipment[]) => {
    try {
      localStorage.setItem('specialtech_equipment_list', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const persistShiftReports = (nextList: ShiftReport[]) => {
    try {
      localStorage.setItem('specialtech_shift_reports', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const persistAnomalies = (nextList: AnomalyAlert[]) => {
    try {
      localStorage.setItem('specialtech_anomalies', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const persistChatMessages = (nextList: ChatMessage[]) => {
    try {
      localStorage.setItem('specialtech_chat_messages', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const handleSaveBranch = (updatedBranch: FleetBranch) => {
    const prevBranch = branches.find(b => b.id === updatedBranch.id);
    const cleanCode =
      updatedBranch.code.trim().toUpperCase() || prevBranch?.code || 'FIL';
    const normalizedBranch: FleetBranch = {
      ...updatedBranch,
      code: cleanCode,
      documentFlow: {
        ...updatedBranch.documentFlow,
        orderPrefix:
          updatedBranch.documentFlow.orderPrefix.trim() ||
          prevBranch?.documentFlow.orderPrefix ||
          `RO-${cleanCode}-`,
        waybillPrefix:
          updatedBranch.documentFlow.waybillPrefix.trim() ||
          prevBranch?.documentFlow.waybillPrefix ||
          `ПЛ-${cleanCode}-`,
        shiftPrefix:
          updatedBranch.documentFlow.shiftPrefix.trim() ||
          prevBranch?.documentFlow.shiftPrefix ||
          `SH-${cleanCode}-`,
        actPrefix:
          updatedBranch.documentFlow.actPrefix.trim() ||
          prevBranch?.documentFlow.actPrefix ||
          `КС2-${cleanCode}-`,
        oneCDepartmentCode:
          updatedBranch.documentFlow.oneCDepartmentCode.trim() ||
          prevBranch?.documentFlow.oneCDepartmentCode ||
          `ПОДР-${cleanCode}-01`
      }
    };

    setBranches(prev => {
      const next = prev.map(b => (b.id === normalizedBranch.id ? normalizedBranch : b));
      try {
        localStorage.setItem('specialtech_branches', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    if (prevBranch) {
      const oldOrderPrefix = prevBranch.documentFlow.orderPrefix;
      const newOrderPrefix = normalizedBranch.documentFlow.orderPrefix;
      const oldWaybillPrefix = prevBranch.documentFlow.waybillPrefix;
      const newWaybillPrefix = normalizedBranch.documentFlow.waybillPrefix;
      const oldShiftPrefix = prevBranch.documentFlow.shiftPrefix;
      const newShiftPrefix = normalizedBranch.documentFlow.shiftPrefix;
      const oldActPrefix = prevBranch.documentFlow.actPrefix;
      const newActPrefix = normalizedBranch.documentFlow.actPrefix;
      const oldActServicesPrefix = deriveActServicesPrefix(oldActPrefix, prevBranch.code);
      const newActServicesPrefix = deriveActServicesPrefix(newActPrefix, normalizedBranch.code);
      const oldOneCCode = prevBranch.documentFlow.oneCDepartmentCode;
      const newOneCCode = normalizedBranch.documentFlow.oneCDepartmentCode;

      const orderPrefixChanged = oldOrderPrefix !== newOrderPrefix;
      const waybillPrefixChanged = oldWaybillPrefix !== newWaybillPrefix;
      const shiftPrefixChanged = oldShiftPrefix !== newShiftPrefix;
      const actPrefixChanged = oldActPrefix !== newActPrefix;
      const actServicesPrefixChanged = oldActServicesPrefix !== newActServicesPrefix;
      const oneCCodeChanged = oldOneCCode !== newOneCCode;
      const branchMetaChanged =
        prevBranch.name !== normalizedBranch.name ||
        prevBranch.city !== normalizedBranch.city ||
        prevBranch.fleetManagerName !== normalizedBranch.fleetManagerName ||
        prevBranch.baseAddress !== normalizedBranch.baseAddress ||
        prevBranch.code !== normalizedBranch.code;

      const remapActNumber = (val?: string) => {
        if (!val) return val;
        const afterServices = replaceLeadingPrefix(
          val,
          oldActServicesPrefix,
          newActServicesPrefix
        );
        return replaceLeadingPrefix(afterServices, oldActPrefix, newActPrefix);
      };

      const remapKs2Number = (val?: string) =>
        val ? replaceLeadingPrefix(val, oldActPrefix, newActPrefix) : val;

      const replaceTextTokens = (text: string) => {
        let out = text;
        if (orderPrefixChanged) out = out.split(oldOrderPrefix).join(newOrderPrefix);
        if (waybillPrefixChanged) out = out.split(oldWaybillPrefix).join(newWaybillPrefix);
        if (shiftPrefixChanged) out = out.split(oldShiftPrefix).join(newShiftPrefix);
        if (actPrefixChanged) out = out.split(oldActPrefix).join(newActPrefix);
        if (actServicesPrefixChanged) {
          out = out.split(oldActServicesPrefix).join(newActServicesPrefix);
        }
        if (oneCCodeChanged) out = out.split(oldOneCCode).join(newOneCCode);
        return out;
      };

      if (orderPrefixChanged || actPrefixChanged || actServicesPrefixChanged) {
        setOrders(prev => {
          const next = prev.map(order =>
            order.branchId === normalizedBranch.id
              ? {
                  ...order,
                  orderNumber: replaceLeadingPrefix(
                    order.orderNumber,
                    oldOrderPrefix,
                    newOrderPrefix
                  ),
                  actNumber: remapActNumber(order.actNumber),
                  ks2Number: remapKs2Number(order.ks2Number)
                }
              : order
          );
          persistOrders(next);
          return next;
        });
      }

      if (actPrefixChanged || actServicesPrefixChanged) {
        setDeals(prev => {
          const next = prev.map(deal =>
            deal.branchId === normalizedBranch.id
              ? {
                  ...deal,
                  actNumber: remapActNumber(deal.actNumber),
                  ks2Number: remapKs2Number(deal.ks2Number)
                }
              : deal
          );
          persistDeals(next);
          return next;
        });
      }

      const updatedClosingDocsMap = new Map<string, ClosingDocumentRecord>();
      if (
        orderPrefixChanged ||
        actPrefixChanged ||
        actServicesPrefixChanged ||
        oneCCodeChanged ||
        branchMetaChanged
      ) {
        const nextClosingDocs = closingDocs.map(doc => {
          if (doc.branchId !== normalizedBranch.id) return doc;
          const nextNumber =
            doc.kind === 'ks2'
              ? remapKs2Number(doc.number) || doc.number
              : doc.kind === 'act_services'
              ? remapActNumber(doc.number) || doc.number
              : doc.number;
          const nextOrderOrDealNumber =
            doc.sourceType === 'order'
              ? replaceLeadingPrefix(
                  doc.orderOrDealNumber,
                  oldOrderPrefix,
                  newOrderPrefix
                )
              : doc.orderOrDealNumber;
          const updatedDoc: ClosingDocumentRecord = {
            ...doc,
            number: nextNumber,
            orderOrDealNumber: nextOrderOrDealNumber
          };
          updatedDoc.contentText = generateClosingDocPlainText(
            updatedDoc,
            normalizedBranch,
            oneCConfig
          );
          updatedClosingDocsMap.set(updatedDoc.id, updatedDoc);
          return updatedDoc;
        });
        persistClosingDocs(nextClosingDocs);
        setClosingDocs(nextClosingDocs);
      }

      if (
        orderPrefixChanged ||
        waybillPrefixChanged ||
        shiftPrefixChanged ||
        actPrefixChanged ||
        actServicesPrefixChanged ||
        oneCCodeChanged ||
        branchMetaChanged
      ) {
        setLegalDocuments(prev => {
          const next = prev.map(doc => {
            if (doc.branchId !== normalizedBranch.id) return doc;

            if (doc.id.startsWith('leg-cdoc-')) {
              const cdocId = doc.id.slice('leg-'.length);
              const syncedClosing = updatedClosingDocsMap.get(cdocId);
              if (syncedClosing) {
                return {
                  ...doc,
                  number: syncedClosing.number,
                  title: `${CLOSING_DOC_KIND_LABELS[syncedClosing.kind]} № ${syncedClosing.number} (${syncedClosing.clientName})`,
                  linkedOrderNumber: syncedClosing.orderOrDealNumber,
                  content: syncedClosing.contentText
                };
              }
              const isKs2 = doc.id.endsWith('-ks2');
              const isAct = doc.id.endsWith('-act_services');
              const nextNumber = isKs2
                ? remapKs2Number(doc.number) || doc.number
                : isAct
                ? remapActNumber(doc.number) || doc.number
                : doc.number;
              const nextLinked = doc.linkedOrderNumber
                ? replaceLeadingPrefix(
                    doc.linkedOrderNumber,
                    oldOrderPrefix,
                    newOrderPrefix
                  )
                : doc.linkedOrderNumber;
              return {
                ...doc,
                number: nextNumber,
                linkedOrderNumber: nextLinked,
                title: doc.number !== nextNumber ? doc.title.split(doc.number).join(nextNumber) : doc.title,
                content: replaceTextTokens(
                  doc.number !== nextNumber ? doc.content.split(doc.number).join(nextNumber) : doc.content
                )
              };
            }

            const nextNumber = replaceLeadingPrefix(doc.number, oldOrderPrefix, newOrderPrefix);
            const nextLinked = doc.linkedOrderNumber
              ? replaceLeadingPrefix(
                  doc.linkedOrderNumber,
                  oldOrderPrefix,
                  newOrderPrefix
                )
              : doc.linkedOrderNumber;

            let nextTitle = doc.title;
            if (doc.number !== nextNumber) {
              nextTitle = nextTitle.split(doc.number).join(nextNumber);
            }
            nextTitle = replaceTextTokens(nextTitle);

            let nextContent = doc.content;
            if (doc.number !== nextNumber) {
              nextContent = nextContent.split(doc.number).join(nextNumber);
            }
            if (doc.linkedOrderNumber && nextLinked && doc.linkedOrderNumber !== nextLinked) {
              nextContent = nextContent.split(doc.linkedOrderNumber).join(nextLinked);
            }
            nextContent = replaceTextTokens(nextContent);

            const nextDisputeReason = doc.disputeReason
              ? replaceTextTokens(doc.disputeReason)
              : doc.disputeReason;

            return {
              ...doc,
              number: nextNumber,
              linkedOrderNumber: nextLinked,
              title: nextTitle,
              disputeReason: nextDisputeReason,
              content: nextContent
            };
          });
          persistLegalDocs(next);
          return next;
        });
      }

      if (shiftPrefixChanged || waybillPrefixChanged) {
        setShiftReports(prev => {
          const next = prev.map(shift => {
            if (shift.branchId !== normalizedBranch.id) return shift;
            return {
              ...shift,
              shiftNumber: replaceLeadingPrefix(
                shift.shiftNumber,
                oldShiftPrefix,
                newShiftPrefix
              ),
              waybillNumber: shift.waybillNumber
                ? replaceLeadingPrefix(
                    shift.waybillNumber,
                    oldWaybillPrefix,
                    newWaybillPrefix
                  )
                : undefined
            };
          });
          persistShiftReports(next);
          return next;
        });
      }

      if (shiftPrefixChanged) {
        setAnomalies(prev => {
          const next = prev.map(anomaly =>
            anomaly.branchId === normalizedBranch.id
              ? {
                  ...anomaly,
                  title: anomaly.title.split(oldShiftPrefix).join(newShiftPrefix),
                  description: anomaly.description.split(oldShiftPrefix).join(newShiftPrefix)
                }
              : anomaly
          );
          persistAnomalies(next);
          return next;
        });
      }

      if (
        shiftPrefixChanged ||
        waybillPrefixChanged ||
        orderPrefixChanged ||
        actPrefixChanged ||
        actServicesPrefixChanged ||
        oneCCodeChanged
      ) {
        setChatMessages(prev => {
          const next = prev.map(msg => {
            if (msg.branchId !== normalizedBranch.id) return msg;
            return {
              ...msg,
              text: replaceTextTokens(msg.text),
              confirmation: msg.confirmation
                ? {
                    ...msg.confirmation,
                    shiftNumber: msg.confirmation.shiftNumber
                      ? replaceLeadingPrefix(
                          msg.confirmation.shiftNumber,
                          oldShiftPrefix,
                          newShiftPrefix
                        )
                      : msg.confirmation.shiftNumber
                  }
                : undefined
            };
          });
          persistChatMessages(next);
          return next;
        });
      }
    }
  };

  const handleCreateBranch = (newBranch: FleetBranch) => {
    const cleanCode = newBranch.code.trim().toUpperCase() || 'FIL';
    const normalizedNew: FleetBranch = {
      ...newBranch,
      code: cleanCode,
      documentFlow: {
        ...newBranch.documentFlow,
        orderPrefix: newBranch.documentFlow.orderPrefix.trim() || `RO-${cleanCode}-`,
        waybillPrefix: newBranch.documentFlow.waybillPrefix.trim() || `ПЛ-${cleanCode}-`,
        shiftPrefix: newBranch.documentFlow.shiftPrefix.trim() || `SH-${cleanCode}-`,
        actPrefix: newBranch.documentFlow.actPrefix.trim() || `КС2-${cleanCode}-`,
        oneCDepartmentCode:
          newBranch.documentFlow.oneCDepartmentCode.trim() || `ПОДР-${cleanCode}-01`
      }
    };
    setBranches(prev => {
      const next = [...prev, normalizedNew];
      try {
        localStorage.setItem('specialtech_branches', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const activeBranch: FleetBranch | null =
    activeBranchId === 'all'
      ? null
      : branches.find(b => b.id === activeBranchId) || branches[0] || null;

  const isIsolatedWorkspace =
    activeBranch !== null && activeBranch.documentFlow.isolateCrmAndErp;

  const scopedEquipment = isIsolatedWorkspace
    ? equipmentList.filter(e => e.branchId === activeBranch.id)
    : equipmentList;
  const scopedDeals = isIsolatedWorkspace
    ? deals.filter(d => d.branchId === activeBranch.id)
    : deals;
  const scopedOrders = isIsolatedWorkspace
    ? orders.filter(o => o.branchId === activeBranch.id)
    : orders;
  const scopedShiftReports = isIsolatedWorkspace
    ? shiftReports.filter(s => s.branchId === activeBranch.id)
    : shiftReports;
  const scopedAnomalies = isIsolatedWorkspace
    ? anomalies.filter(a => a.branchId === activeBranch.id)
    : anomalies;
  const scopedChatMessages = isIsolatedWorkspace
    ? chatMessages.filter(m => m.branchId === activeBranch.id)
    : chatMessages;
  const scopedDrivers = isIsolatedWorkspace
    ? drivers.filter(d => d.branchId === activeBranch.id)
    : drivers;
  const scopedClosingDocs = isIsolatedWorkspace
    ? closingDocs.filter(d => d.branchId === activeBranch.id)
    : closingDocs;

  const activeDealsCount = scopedDeals.filter(d => d.stage === 'active').length;
  const activeOrdersCount = scopedOrders.filter(o => o.status === 'active').length;
  const activeRequestsCount = activeDealsCount + activeOrdersCount;
  const hasActiveRequest = activeRequestsCount > 0;

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [fleetConfirmRequest, setFleetConfirmRequest] = useState<{
    dealId?: string;
    confirmType?: ChatConfirmation['type'];
    nonce: number;
  } | null>(null);
  const [chatTargetRequest, setChatTargetRequest] = useState<CustomerChatTarget | null>(null);

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [selectedEquipmentForDetail, setSelectedEquipmentForDetail] = useState<Equipment | null>(null);
  const [closingModalTarget, setClosingModalTarget] = useState<ClosingModalTarget | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [activeStatusToast, setActiveStatusToast] = useState<{
    id: string;
    title: string;
    message: string;
  } | null>(null);

  // Handlers
  const handleCreateShift = (newShift: ShiftReport) => {
    const eq = equipmentList.find(e => e.id === newShift.equipmentId);
    const resolvedBranchId = newShift.branchId || eq?.branchId || activeBranch?.id || 'branch-hq';
    const shiftWithBranch: ShiftReport = {
      ...newShift,
      branchId: resolvedBranchId
    };

    setShiftReports(prev => {
      const next = [shiftWithBranch, ...prev];
      persistShiftReports(next);
      return next;
    });

    const cardFuelOrExpenseRub =
      shiftWithBranch.paymentAmountRub !== undefined
        ? shiftWithBranch.paymentAmountRub
        : shiftWithBranch.fuelLitersAdded * 65;

    const transferTargetEq =
      shiftWithBranch.paymentCategory === 'fuel_for_equipment' &&
      shiftWithBranch.paymentTargetEquipmentId
        ? equipmentList.find(
            e =>
              e.id === shiftWithBranch.paymentTargetEquipmentId &&
              e.branchId === resolvedBranchId
          )
        : undefined;

    const isFuelTransferred = Boolean(transferTargetEq);

    // Update equipment monthHours, currentHours, fuelCost and reallocated card expenses
    setEquipmentList(prev => {
      const next = prev.map(item => {
        let updatedEq = item;

        if (item.id === shiftWithBranch.equipmentId) {
          const addedHours = shiftWithBranch.workHours;
          const addedRevenue = addedHours * item.hourlyRate;
          const newTotalHours = item.currentHours + addedHours;
          const nextTO = Math.max(0, item.nextMaintenanceInHours - addedHours);

          const ownFuelAdd =
            !isFuelTransferred &&
            (shiftWithBranch.paymentCategory === undefined || shiftWithBranch.paymentCategory === 'fuel_own_tank')
              ? cardFuelOrExpenseRub
              : 0;
          const ownRepairAdd = shiftWithBranch.paymentCategory === 'parts' ? cardFuelOrExpenseRub : 0;
          const ownOtherAdd = shiftWithBranch.paymentCategory === 'other' ? cardFuelOrExpenseRub : 0;

          updatedEq = {
            ...item,
            currentHours: newTotalHours,
            monthHours: item.monthHours + addedHours,
            mileageKmMonth: (item.mileageKmMonth ?? 0) + (shiftWithBranch.mileageKm ?? 0),
            tripsMonth:
              item.type === 'dump_truck'
                ? (item.tripsMonth ?? 0) + (shiftWithBranch.tripsCount ?? 0)
                : item.tripsMonth,
            fuelCostMonth: item.fuelCostMonth + ownFuelAdd,
            repairCostMonth: item.repairCostMonth + ownRepairAdd,
            subcontractCostMonth:
              (item.subcontractCostMonth ?? 0) + (shiftWithBranch.subcontractCostRub ?? 0),
            overheadsAllocated: item.overheadsAllocated + ownOtherAdd,
            driverSalaryMonth: item.driverSalaryMonth + shiftWithBranch.calculatedSalary,
            revenueMonth: item.revenueMonth + addedRevenue,
            nextMaintenanceInHours: nextTO
          };
        }

        if (isFuelTransferred && item.id === shiftWithBranch.paymentTargetEquipmentId) {
          updatedEq = {
            ...updatedEq,
            fuelCostMonth: updatedEq.fuelCostMonth + cardFuelOrExpenseRub
          };
        }

        return updatedEq;
      });
      persistEquipmentList(next);
      return next;
    });

    // If marked as anomaly, add to anomalies feed (non-blocking: Alert + log + driver notification)
    if (shiftWithBranch.status === 'anomaly') {
      setAnomalies(prev => {
        const next: AnomalyAlert[] = [
          {
            id: `ano-${Date.now()}`,
            branchId: resolvedBranchId,
            severity: 'critical',
            category: 'shift',
            title: `Отклонение в смене ${shiftWithBranch.shiftNumber}`,
            description: shiftWithBranch.anomalyMessage || 'Отклонение в сменном рапорте — зафиксировано в логах, водитель уведомлён к отчёту в конце месяца.',
            equipmentId: shiftWithBranch.equipmentId,
            equipmentName: eq ? `[${eq.inventoryNumber}] ${eq.name}` : undefined,
            date: shiftWithBranch.date,
            impactRubles: 15000,
            resolved: false
          },
          ...prev
        ];
        persistAnomalies(next);
        return next;
      });
    }
  };

  const persistDeals = (next: CRMDeal[]) => {
    try {
      localStorage.setItem('specialtech_crm_deals', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const checkCompletedRetention = () => {
      setDeals(prev => {
        const { next, changed } = archiveExpiredCompletedDeals(prev);
        if (!changed) return prev;
        persistDeals(next);
        return next;
      });
    };
    const timer = window.setInterval(checkCompletedRetention, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const persistOrders = (next: RentalOrder[]) => {
    try {
      localStorage.setItem('specialtech_rental_orders', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const persistClosingDocs = (next: ClosingDocumentRecord[]) => {
    try {
      localStorage.setItem('specialtech_closing_docs', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleCreateDeal = (newDeal: CRMDeal) => {
    const nowIso = new Date().toISOString();
    const stampedDeal: CRMDeal = {
      ...newDeal,
      stageUpdatedAt: newDeal.stageUpdatedAt || nowIso
    };
    setDeals(prev => {
      const next = [stampedDeal, ...prev];
      persistDeals(next);
      return next;
    });
  };

  const handleUpdateDeal = (updatedDeal: CRMDeal) => {
    setDeals(prev => {
      const next = prev.map(d => (d.id === updatedDeal.id ? updatedDeal : d));
      persistDeals(next);
      return next;
    });
  };

  const handleModerateShift = (shiftId: string, patch: Partial<ShiftReport>) => {
    setShiftReports(prev => {
      const next = prev.map(s => (s.id === shiftId ? { ...s, ...patch } : s));
      persistShiftReports(next);
      return next;
    });
  };

  const handleUpdateEquipmentSite = (eqId: string, site: string) => {
    setEquipmentList(prev => {
      const next = prev.map(e => (e.id === eqId ? { ...e, assignedSite: site } : e));
      persistEquipmentList(next);
      return next;
    });
  };

  const handleUpdateMaxBotConfig = (branchId: string, config: MaxCustomerBotConfig) => {
    setMaxBotConfigs(prev => {
      const next = { ...prev, [branchId]: config };
      try {
        localStorage.setItem('specialtech_max_client_bot_config', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleMoveDealStage = (dealId: string, nextStage: CRMStage) => {
    const nowIso = new Date().toISOString();
    setDeals(prev => {
      const target = prev.find(d => d.id === dealId);
      if (!target) return prev;

      if (nextStage === 'completed') {
        const hasDocVolume = Boolean(
          target.actSigned ||
            target.actSavedToBase ||
            target.ks2SavedToBase ||
            target.ks3SavedToBase
        );
        if (!hasDocVolume || target.debtAmount > 0) {
          return prev;
        }
      }

      const updatedTarget: CRMDeal = {
        ...target,
        stage: nextStage,
        stageUpdatedAt: nowIso,
        completedAt: nextStage === 'completed' ? nowIso : undefined,
        archivedAt: undefined
      };

      const next = [updatedTarget, ...prev.filter(d => d.id !== dealId)];
      persistDeals(next);
      return next;
    });
  };

  const handleCloseDealShift = (
    dealId: string,
    payload: { date: string; shiftSlot: 1 | 2; hours: number }
  ) => {
    const clampedHours = Math.min(12, Math.max(1, Number(payload.hours) || 1));
    const targetDeal = deals.find(d => d.id === dealId);
    if (!targetDeal) return;

    const existingLogs = targetDeal.shiftLogs || [];
    const dayLogs = existingLogs.filter(s => s.date === payload.date);
    if (dayLogs.length >= 2 || dayLogs.some(s => s.shiftSlot === payload.shiftSlot)) {
      return;
    }

    const newLog = {
      id: `dsh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: payload.date,
      shiftSlot: payload.shiftSlot,
      hours: clampedHours,
      closedAt: formatNowTimestamp()
    };
    const nextLogs = [...existingLogs, newLog];
    const nextShiftTotal = nextLogs.reduce((acc, s) => acc + s.hours, 0);

    setDeals(prev => {
      const next = prev.map(d =>
        d.id === dealId
          ? {
              ...d,
              shiftLogs: nextLogs,
              closedShiftHoursTotal: nextShiftTotal
            }
          : d
      );
      persistDeals(next);
      return next;
    });

    handleSendChatMessage({
      branchId: targetDeal.branchId,
      dealId: targetDeal.id,
      senderName:
        branches.find(b => b.id === targetDeal.branchId)?.fleetManagerName ||
        'Fleet Manager',
      senderRole: 'fleet_manager',
      text: `Закрыта ${payload.shiftSlot}-я смена за ${payload.date}: ${clampedHours} м/ч (${targetDeal.clientName}, ${targetDeal.siteAddress}). Итого по сменам: ${nextShiftTotal} м/ч.`
    });
  };

  const handleCloseDealVolume = (dealId: string, volumeHours: number) => {
    const targetDeal = deals.find(d => d.id === dealId);
    if (!targetDeal) return;

    const qty = Math.max(0, Number(volumeHours) || 0);
    const branch = branches.find(b => b.id === targetDeal.branchId) || branches[0];
    const branchCode = branch?.code || 'MSK';
    const actPrefix = getActServicesPrefix(branch);
    const ks2Prefix = getKs2Prefix(branch);
    const tail = targetDeal.id.replace(/\D/g, '') || '201';
    const today = new Date().toISOString().split('T')[0];
    const nowStamp = formatNowTimestamp();
    const subject =
      targetDeal.accountingSubject ||
      (targetDeal.clientType === 'individual' || targetDeal.hasContract === false
        ? 'ip_specialtechnica'
        : 'ooo_specialtech');
    const totalRub = Math.round(qty * targetDeal.hourlyRateAgreed);
    const vatRub = subject === 'ooo_specialtech' ? Math.round((totalRub * 20) / 120) : 0;
    const eq = targetDeal.equipmentAssignedId
      ? equipmentList.find(e => e.id === targetDeal.equipmentAssignedId)
      : equipmentList.find(
          e => e.branchId === targetDeal.branchId && e.type === targetDeal.equipmentType
        );
    const eqTitle = eq
      ? `[${eq.inventoryNumber}] ${eq.name} (${eq.plateNumber})`
      : `Спецтехника (${targetDeal.equipmentType})`;
    const operatorName =
      targetDeal.assignedDriverName || eq?.assignedOperator || 'Дежурный экипаж';

    const makeClosing = (
      kind: 'act_services' | 'ks2' | 'ks3',
      number: string
    ): ClosingDocumentRecord => {
      const rec: ClosingDocumentRecord = {
        id: `cdoc-deal-${targetDeal.id}-${kind}`,
        kind,
        number,
        date: today,
        periodStart: targetDeal.dateCreated || today,
        periodEnd: today,
        branchId: targetDeal.branchId,
        sourceType: 'deal',
        sourceId: targetDeal.id,
        orderOrDealNumber: `CRM-${targetDeal.id.toUpperCase()}`,
        clientName: targetDeal.clientName,
        siteAddress: targetDeal.siteAddress,
        equipmentName: eqTitle,
        operatorName,
        workDescription: `Аренда и выполнение работ спецтехникой (${eqTitle})`,
        unitLabel: 'маш.-час',
        quantity: qty,
        rateRub: targetDeal.hourlyRateAgreed,
        totalAmountRub: totalRub,
        vatAmountRub: vatRub,
        accountingSubject: subject,
        savedToBase: true,
        savedAt: nowStamp,
        contentText: ''
      };
      rec.contentText = generateClosingDocPlainText(rec, branch, oneCConfig);
      return rec;
    };

    const actDoc = makeClosing(
      'act_services',
      targetDeal.actNumber || `${actPrefix}CRM-${tail}`
    );
    const ks2Doc = makeClosing(
      'ks2',
      targetDeal.ks2Number || `${ks2Prefix}CRM-${tail}`
    );
    const ks3Doc = makeClosing(
      'ks3',
      targetDeal.ks3Number || `КС3-${branchCode}-CRM-${tail}`
    );

    handleCloseVolumeAndSign(actDoc, ks2Doc, ks3Doc);
  };

  const appendLegalHistory = (entry: Omit<LegalHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: LegalHistoryEntry = {
      ...entry,
      id: `lh-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      timestamp: formatNowTimestamp()
    };
    setLegalHistory(prev => {
      const next = [newEntry, ...prev];
      try {
        localStorage.setItem('specialtech_legal_history', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const persistLegalDocs = (next: LegalDocument[]) => {
    try {
      localStorage.setItem('specialtech_legal_docs', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleCreateLegalDocument = (
    doc: LegalDocument,
    actorRole: LegalRole,
    actorName: string
  ) => {
    setLegalDocuments(prev => {
      const next = [doc, ...prev];
      persistLegalDocs(next);
      return next;
    });
    appendLegalHistory({
      documentId: doc.id,
      documentNumber: doc.number,
      documentTitle: doc.title,
      action: doc.kind === 'dispute' || doc.kind === 'claim' ? 'dispute_opened' : 'created',
      actorRole,
      actorName,
      details: `Создан документ вида «${doc.kind}» для контрагента ${doc.counterparty}.`
    });
  };

  const handleUpdateLegalDocument = (
    updatedDoc: LegalDocument,
    actorRole: LegalRole,
    actorName: string,
    actionDetails?: string
  ) => {
    setLegalDocuments(prev => {
      const next = prev.map(d => (d.id === updatedDoc.id ? updatedDoc : d));
      persistLegalDocs(next);
      return next;
    });
    appendLegalHistory({
      documentId: updatedDoc.id,
      documentNumber: updatedDoc.number,
      documentTitle: updatedDoc.title,
      action: actionDetails?.includes('Статус') ? 'status_changed' : 'updated',
      actorRole,
      actorName,
      details: actionDetails || 'Обновлён документ в реестре.'
    });
  };

  const handleImportLegalDocuments = (
    imported: LegalDocument[],
    actorRole: LegalRole,
    actorName: string
  ) => {
    setLegalDocuments(prev => {
      const next = [...imported, ...prev];
      persistLegalDocs(next);
      return next;
    });
    imported.forEach(doc => {
      appendLegalHistory({
        documentId: doc.id,
        documentNumber: doc.number,
        documentTitle: doc.title,
        action: 'imported',
        actorRole,
        actorName,
        details: `Импортирован в реестр (${doc.counterparty}).`
      });
    });
  };

  const handleSaveLegalDocToBase = (
    doc: LegalDocument,
    actorRole: LegalRole,
    actorName: string,
    options?: {
      mode: 'anonymized' | 'full';
      targetCategory: KnowledgeDoc['category'];
    }
  ) => {
    const defaultCategory: KnowledgeDoc['category'] =
      doc.kind === 'template'
        ? 'templates'
        : doc.kind === 'dispute' || doc.kind === 'claim' || doc.status === 'dispute'
        ? 'disputes'
        : 'contracts';
    const category = options?.targetCategory || defaultCategory;
    const mode = options?.mode || (doc.kind === 'template' ? 'full' : 'anonymized');
    const shouldAnonymize = mode === 'anonymized';

    const publishedText = shouldAnonymize
      ? anonymizeLegalText(doc.content, doc.counterparty)
      : doc.content;
    const publishedTitle =
      shouldAnonymize && doc.kind !== 'template'
        ? `Обезличенный образец: ${anonymizeLegalText(doc.title, doc.counterparty)}`
        : doc.title;
    const publishedCode =
      shouldAnonymize && doc.kind !== 'template' ? `ОБРАЗЕЦ-${doc.number}` : doc.number;

    const kbEntry: KnowledgeDoc = {
      id: `kb-${doc.id}`,
      title: publishedTitle,
      category,
      code: publishedCode,
      dateUpdated: doc.updatedAt,
      excerpt: shouldAnonymize
        ? `Обезличенный документ из изолированной базы юриста (${doc.authorName})`
        : `${doc.counterparty} · ${
            doc.disputeReason ? doc.disputeReason : `Документ юриста (${doc.authorName})`
          }`,
      tags: [
        category === 'disputes'
          ? 'споры'
          : category === 'templates'
          ? 'шаблон'
          : category === 'regulations'
          ? 'регламент'
          : 'договор',
        shouldAnonymize ? 'обезличено' : 'полный-текст',
        doc.accountingSubject === 'ip_specialtechnica' ? 'ИП' : 'ООО'
      ],
      fullText: publishedText
    };

    setDocs(prev => {
      const exists = prev.some(item => item.id === kbEntry.id || item.code === kbEntry.code);
      const next = exists
        ? prev.map(item =>
            item.id === kbEntry.id || item.code === kbEntry.code ? kbEntry : item
          )
        : [kbEntry, ...prev];
      try {
        localStorage.setItem('specialtech_knowledge_docs', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    setLegalDocuments(prev => {
      const next = prev.map(d => (d.id === doc.id ? { ...d, inKnowledgeBase: true } : d));
      persistLegalDocs(next);
      return next;
    });

    const catLabelMap: Record<KnowledgeDoc['category'], string> = {
      templates: 'Шаблоны',
      contracts: 'Договора',
      disputes: 'Споры',
      regulations: 'Регламенты аренды',
      fuel_norms: 'Нормы ГСМ',
      maintenance: 'Техобслуживание',
      payroll: 'Оплата труда'
    };

    appendLegalHistory({
      documentId: doc.id,
      documentNumber: doc.number,
      documentTitle: doc.title,
      action: 'saved_to_base',
      actorRole,
      actorName,
      details: `Осознанная передача в «Базу знаний» (раздел «${catLabelMap[category]}», режим: ${
        shouldAnonymize ? 'обезличенный образец' : 'полный текст'
      }).`
    });
  };

  const handleLogLegalExport = (
    details: string,
    doc: LegalDocument | null,
    actorRole: LegalRole,
    actorName: string
  ) => {
    appendLegalHistory({
      documentId: doc?.id || 'base-export',
      documentNumber: doc?.number || 'БАЗА-ЭКСПОРТ',
      documentTitle: doc?.title || 'Полная база документов',
      action: 'exported',
      actorRole,
      actorName,
      details
    });
  };

  const handleOpenCustomerContract = (payload: {
    docId?: string;
    docNumber?: string;
    clientName: string;
    branchId: string;
    orderNumber?: string;
    subjectId: AccountingSubjectId;
    hasContract: boolean;
  }) => {
    const existingDoc =
      (payload.docId && legalDocuments.find(d => d.id === payload.docId)) ||
      legalDocuments.find(
        d =>
          d.branchId === payload.branchId &&
          d.counterparty === payload.clientName &&
          (d.kind === 'contract' || d.kind === 'addendum')
      ) ||
      (payload.orderNumber
        ? legalDocuments.find(
            d =>
              d.branchId === payload.branchId &&
              d.linkedOrderNumber === payload.orderNumber
          )
        : undefined);

    if (existingDoc) {
      setContractsTabRequest({
        tab:
          existingDoc.kind === 'dispute' || existingDoc.kind === 'claim'
            ? 'disputes'
            : 'registry',
        docCode: existingDoc.number,
        nonce: Date.now()
      });
      setCurrentTab('contracts');
      return;
    }

    const branch = branches.find(b => b.id === payload.branchId) || branches[0];
    const branchCode = branch?.code || 'MSK';
    const orgMeta = CLIENT_ORG_DIRECTORY[payload.clientName];
    const clientOrders = orders.filter(
      o => o.branchId === payload.branchId && o.clientName === payload.clientName
    );
    const clientDeals = deals.filter(
      d => d.branchId === payload.branchId && d.clientName === payload.clientName
    );
    const latestOrder = clientOrders[clientOrders.length - 1];
    const latestDeal = clientDeals[clientDeals.length - 1];
    const amountRub =
      clientOrders.reduce((acc, o) => acc + o.totalAmount, 0) ||
      clientDeals.reduce((acc, d) => acc + d.estimatedAmount, 0);
    const today = new Date().toISOString().split('T')[0];
    const seq = String(legalDocuments.length + 10).padStart(3, '0');
    const rawOrderPrefix = branch?.documentFlow.orderPrefix?.trim() || `ДОГ-${branchCode}-`;
    const normalizedOrderPrefix =
      rawOrderPrefix.endsWith('-') || rawOrderPrefix.endsWith('/')
        ? rawOrderPrefix
        : `${rawOrderPrefix}-`;
    const docNumber = payload.hasContract
      ? `${normalizedOrderPrefix}2026/${seq}`
      : `ОФР-${branchCode}-2026/${seq}`;
    const subjectEntity = oneCConfig.subjects[payload.subjectId];
    const siteAddr =
      latestOrder?.siteAddress || latestDeal?.siteAddress || branch?.city || 'По заявкам';

    const newContractDoc: LegalDocument = {
      id: `leg-auto-${Date.now()}`,
      number: docNumber,
      title: payload.hasContract
        ? `Договор аренды спецтехники с экипажем № ${docNumber} (${payload.clientName})`
        : `Договор-заявка (оферта) № ${docNumber} (${payload.clientName})`,
      kind: 'contract',
      branchId: payload.branchId,
      counterparty: payload.clientName,
      accountingSubject: payload.subjectId,
      status: latestOrder?.status === 'active' ? 'active' : 'review',
      createdAt: today,
      updatedAt: today,
      authorName: branch?.fleetManagerName || 'Fleet Manager',
      amountRub,
      linkedOrderNumber: latestOrder?.orderNumber || payload.orderNumber,
      inKnowledgeBase: false,
      content: `${
        payload.hasContract
          ? `ДОГОВОР АРЕНДЫ СТРОИТЕЛЬНОЙ СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № ${docNumber}`
          : `ДОГОВОР-ЗАЯВКА НА ОКАЗАНИЕ УСЛУГ СПЕЦТЕХНИКОЙ № ${docNumber}`
      }\n\n${branch?.city || 'г. Москва'} · Дата: ${today}\n\nИсполнитель (Арендодатель): ${
        subjectEntity.entityName
      } (${subjectEntity.taxSystem}, ИНН ${subjectEntity.inn})\nПодразделение 1С: ${
        branch?.documentFlow.oneCDepartmentCode || 'ПОДР-01'
      } (${branch?.name || ''})\n\nЗаказчик (Арендатор): ${
        orgMeta?.fullName || payload.clientName
      }\nИНН ${orgMeta?.inn || '—'}${orgMeta?.kpp && orgMeta.kpp !== '—' ? ` / КПП ${orgMeta.kpp}` : ''}${
        orgMeta?.ogrn && orgMeta.ogrn !== '—' ? ` / ОГРН ${orgMeta.ogrn}` : ''
      }\nЮр. адрес: ${orgMeta?.legalAddress || siteAddr}\nРуководитель / контакт: ${
        latestDeal?.contactPerson || orgMeta?.director || '—'
      } (${latestDeal?.phone || orgMeta?.phoneFallback || '—'})\nБанковские реквизиты: ${
        orgMeta?.bankName || 'По карточке 1С'
      }, р/с ${orgMeta?.checkingAccount || '—'}\n\n1. ПРЕДМЕТ И ОБЪЕКТ РАБОТ\n1.1. Адрес строительного объекта: ${siteAddr}.\n1.2. Связанный заказ-наряд: ${
        latestOrder?.orderNumber || 'по заявке CRM'
      }.\n1.3. Оценочная сумма / оборот по договору: ${amountRub.toLocaleString('ru-RU')} ₽.`
    };

    handleCreateLegalDocument(
      newContractDoc,
      'admin',
      branch?.fleetManagerName || 'Fleet Manager'
    );
    setContractsTabRequest({
      tab: 'registry',
      docCode: newContractDoc.number,
      nonce: Date.now()
    });
    setCurrentTab('contracts');
  };

  const handleOpenCustomerChat = (payload: {
    branchId: string;
    clientName: string;
    contactPerson: string;
    phone: string;
    dealId?: string;
  }) => {
    if (activeBranch && activeBranch.id !== payload.branchId) {
      handleSelectBranch(payload.branchId);
    }
    setChatTargetRequest({
      ...payload,
      nonce: Date.now()
    });
    setCurrentTab('chat');
  };

  const dispatchStatusNotification = (payload: {
    branchId: string;
    category: StatusNotificationItem['category'];
    title: string;
    message: string;
    entityLabel: string;
  }) => {
    if (!notificationSettings.enabled) return;
    if (
      payload.category === 'act_ks2' &&
      !notificationSettings.onVolumeCloseActKs2 &&
      !notificationSettings.onActSignedChange
    ) {
      return;
    }
    if (payload.category === 'invoice' && !notificationSettings.onInvoiceIssued) {
      return;
    }
    if (
      payload.category === 'payment_status' &&
      !notificationSettings.onInvoiceStatusChange
    ) {
      return;
    }

    const channels = ['ERP журнал'];
    if (notificationSettings.sendToBranchChat) channels.push('Чат участка');
    if (
      notificationSettings.sendToMaxClientBot &&
      maxBotConfigs[payload.branchId]?.enabled
    ) {
      channels.push('Клиент-бот MAX');
    }

    const item: StatusNotificationItem = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formatNowTimestamp(),
      branchId: payload.branchId,
      title: payload.title,
      message: payload.message,
      category: payload.category,
      entityLabel: payload.entityLabel,
      channels,
      read: false
    };

    setStatusNotifications(prev => {
      const next = [item, ...prev].slice(0, 80);
      try {
        localStorage.setItem('specialtech_status_notifications', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    setActiveStatusToast({
      id: item.id,
      title: item.title,
      message: item.message
    });
    setTimeout(() => {
      setActiveStatusToast(curr => (curr?.id === item.id ? null : curr));
    }, 5500);

    if (notificationSettings.sendToBranchChat) {
      handleSendChatMessage({
        branchId: payload.branchId,
        senderName: 'Уведомление ERP',
        senderRole: 'admin',
        text: `[${payload.title}] ${payload.message}`
      });
    }
  };

  const syncClosingDocToSourceAndLegal = (
    doc: ClosingDocumentRecord,
    opts?: { markActSigned?: boolean; invoiceStatus?: InvoiceStatus; paidAmountRub?: number }
  ) => {
    const savedDoc: ClosingDocumentRecord = {
      ...doc,
      savedToBase: true,
      savedAt: doc.savedAt || formatNowTimestamp()
    };

    setClosingDocs(prev => {
      const exists = prev.some(d => d.id === savedDoc.id);
      const next = exists
        ? prev.map(d => (d.id === savedDoc.id ? savedDoc : d))
        : [savedDoc, ...prev];
      persistClosingDocs(next);
      return next;
    });

    // Store / update inside unified legalDocuments registry (specialtech_legal_docs)
    const legalDocId = `leg-${savedDoc.id}`;
    const legalTitle = `${CLOSING_DOC_KIND_LABELS[savedDoc.kind]} № ${savedDoc.number} (${savedDoc.clientName})`;
    const legalEntry: LegalDocument = {
      id: legalDocId,
      number: savedDoc.number,
      title: legalTitle,
      kind: 'addendum',
      branchId: savedDoc.branchId,
      counterparty: savedDoc.clientName,
      accountingSubject: savedDoc.accountingSubject,
      status: 'active',
      createdAt: savedDoc.date,
      updatedAt: savedDoc.date,
      authorName: 'ERP / Закрытие объёма',
      amountRub: savedDoc.totalAmountRub,
      linkedOrderNumber: savedDoc.orderOrDealNumber,
      inKnowledgeBase: true,
      content: savedDoc.contentText
    };

    setLegalDocuments(prev => {
      const exists = prev.some(d => d.id === legalDocId);
      const next = exists
        ? prev.map(d => (d.id === legalDocId ? legalEntry : d))
        : [legalEntry, ...prev];
      persistLegalDocs(next);
      return next;
    });

    appendLegalHistory({
      documentId: legalDocId,
      documentNumber: savedDoc.number,
      documentTitle: legalTitle,
      action: 'saved_to_base',
      actorRole: 'admin',
      actorName: 'Закрытие объёма / Аренда и CRM',
      details: `${CLOSING_DOC_KIND_LABELS[savedDoc.kind]} на сумму ${savedDoc.totalAmountRub.toLocaleString('ru-RU')} ₽ сохранён в базу.`
    });

    if (savedDoc.sourceType === 'order') {
      setOrders(prev => {
        const next = prev.map(o => {
          if (o.id !== savedDoc.sourceId) return o;
          return {
            ...o,
            closedVolumeHours: savedDoc.quantity,
            totalAmount: savedDoc.totalAmountRub,
            actSigned: opts?.markActSigned ? true : o.actSigned,
            actNumber: savedDoc.kind === 'act_services' ? savedDoc.number : o.actNumber,
            ks2Number: savedDoc.kind === 'ks2' ? savedDoc.number : o.ks2Number,
            ks3Number: savedDoc.kind === 'ks3' ? savedDoc.number : o.ks3Number,
            actSavedToBase: savedDoc.kind === 'act_services' ? true : o.actSavedToBase,
            ks2SavedToBase: savedDoc.kind === 'ks2' ? true : o.ks2SavedToBase,
            ks3SavedToBase: savedDoc.kind === 'ks3' ? true : o.ks3SavedToBase,
            invoiceNumber: savedDoc.kind === 'invoice' ? savedDoc.number : o.invoiceNumber,
            invoiceDate: savedDoc.kind === 'invoice' ? savedDoc.date : o.invoiceDate,
            invoiceSavedToBase: savedDoc.kind === 'invoice' ? true : o.invoiceSavedToBase,
            invoiceStatus: opts?.invoiceStatus ?? o.invoiceStatus,
            paidAmount: opts?.paidAmountRub !== undefined ? opts.paidAmountRub : o.paidAmount
          };
        });
        persistOrders(next);
        return next;
      });
    } else {
      const nowIso = new Date().toISOString();
      setDeals(prev => {
        const next = prev.map(d => {
          if (d.id !== savedDoc.sourceId) return d;
          const nextTotal = savedDoc.totalAmountRub || d.estimatedAmount;
          const nextPaid =
            opts?.paidAmountRub !== undefined
              ? opts.paidAmountRub
              : d.paidAmount ?? Math.max(0, nextTotal - (d.debtAmount || 0));
          const nextDebt = Math.max(0, nextTotal - nextPaid);
          const revertedFromCompleted = d.stage === 'completed' && nextDebt > 0;
          return {
            ...d,
            closedVolumeHours: savedDoc.quantity,
            estimatedAmount: nextTotal,
            actSigned: opts?.markActSigned ? true : d.actSigned,
            actNumber: savedDoc.kind === 'act_services' ? savedDoc.number : d.actNumber,
            ks2Number: savedDoc.kind === 'ks2' ? savedDoc.number : d.ks2Number,
            ks3Number: savedDoc.kind === 'ks3' ? savedDoc.number : d.ks3Number,
            actSavedToBase: savedDoc.kind === 'act_services' ? true : d.actSavedToBase,
            ks2SavedToBase: savedDoc.kind === 'ks2' ? true : d.ks2SavedToBase,
            ks3SavedToBase: savedDoc.kind === 'ks3' ? true : d.ks3SavedToBase,
            invoiceNumber: savedDoc.kind === 'invoice' ? savedDoc.number : d.invoiceNumber,
            invoiceDate: savedDoc.kind === 'invoice' ? savedDoc.date : d.invoiceDate,
            invoiceSavedToBase: savedDoc.kind === 'invoice' ? true : d.invoiceSavedToBase,
            invoiceStatus: opts?.invoiceStatus ?? d.invoiceStatus,
            paidAmount: nextPaid,
            debtAmount: nextDebt,
            stage: revertedFromCompleted ? 'active' : d.stage,
            completedAt: revertedFromCompleted ? undefined : d.completedAt,
            archivedAt: revertedFromCompleted ? undefined : d.archivedAt,
            stageUpdatedAt: revertedFromCompleted ? nowIso : d.stageUpdatedAt
          };
        });
        persistDeals(next);
        return next;
      });
    }
  };

  const handleSaveClosingDoc = (doc: ClosingDocumentRecord) => {
    syncClosingDocToSourceAndLegal(doc);
    dispatchStatusNotification({
      branchId: doc.branchId,
      category: doc.kind === 'invoice' ? 'invoice' : 'act_ks2',
      title: `Сохранено в базу: ${CLOSING_DOC_KIND_LABELS[doc.kind]} № ${doc.number}`,
      message: `${doc.clientName} · ${doc.quantity} ${doc.unitLabel} на сумму ${doc.totalAmountRub.toLocaleString('ru-RU')} ₽.`,
      entityLabel: `${doc.orderOrDealNumber} · ${doc.number}`
    });
  };

  const handleCloseVolumeAndSign = (
    actDoc: ClosingDocumentRecord,
    ks2Doc: ClosingDocumentRecord,
    ks3Doc?: ClosingDocumentRecord
  ) => {
    syncClosingDocToSourceAndLegal(actDoc, { markActSigned: true });
    syncClosingDocToSourceAndLegal(ks2Doc, { markActSigned: true });
    if (ks3Doc) {
      syncClosingDocToSourceAndLegal(ks3Doc, { markActSigned: true });
    }
    dispatchStatusNotification({
      branchId: actDoc.branchId,
      category: 'act_ks2',
      title: `Закрыт объём работ: Акт № ${actDoc.number}, КС-2 № ${ks2Doc.number}${
        ks3Doc ? ` и КС-3 № ${ks3Doc.number}` : ''
      }`,
      message: `${actDoc.clientName}: объём ${actDoc.quantity} ${actDoc.unitLabel} (${actDoc.totalAmountRub.toLocaleString('ru-RU')} ₽) зафиксирован документально.`,
      entityLabel: `${actDoc.orderOrDealNumber}`
    });
  };

  const handleIssueInvoice = (
    invoiceDoc: ClosingDocumentRecord,
    invoiceStatus: InvoiceStatus,
    paidAmountRub: number
  ) => {
    syncClosingDocToSourceAndLegal(invoiceDoc, {
      invoiceStatus,
      paidAmountRub
    });
    dispatchStatusNotification({
      branchId: invoiceDoc.branchId,
      category: 'invoice',
      title: `Выставлен счёт № ${invoiceDoc.number}`,
      message: `${invoiceDoc.clientName} · сумма ${invoiceDoc.totalAmountRub.toLocaleString('ru-RU')} ₽ · статус «${INVOICE_STATUS_META[invoiceStatus].label}».`,
      entityLabel: `${invoiceDoc.orderOrDealNumber} · ${invoiceDoc.number}`
    });
  };

  const handleUpdateInvoiceStatus = (
    sourceType: 'order' | 'deal',
    sourceId: string,
    invoiceStatus: InvoiceStatus,
    paidAmountRub: number
  ) => {
    let branchId = activeBranch?.id || 'branch-hq';
    let entityLabel = sourceId;
    let clientName = '';
    let totalRub = 0;

    if (sourceType === 'order') {
      const target = orders.find(o => o.id === sourceId);
      if (target) {
        branchId = target.branchId;
        entityLabel = target.invoiceNumber || target.orderNumber;
        clientName = target.clientName;
        totalRub = target.totalAmount;
      }
      setOrders(prev => {
        const next = prev.map(o =>
          o.id === sourceId
            ? {
                ...o,
                invoiceStatus,
                paidAmount: paidAmountRub
              }
            : o
        );
        persistOrders(next);
        return next;
      });
    } else {
      const target = deals.find(d => d.id === sourceId);
      if (target) {
        branchId = target.branchId;
        entityLabel = target.invoiceNumber || `CRM-${target.id.toUpperCase()}`;
        clientName = target.clientName;
        totalRub = target.estimatedAmount;
      }
      const nowIso = new Date().toISOString();
      setDeals(prev => {
        const targetDeal = prev.find(d => d.id === sourceId);
        if (!targetDeal) return prev;
        const nextDebt = Math.max(0, targetDeal.estimatedAmount - paidAmountRub);
        const revertedFromCompleted = targetDeal.stage === 'completed' && nextDebt > 0;
        const debtChanged =
          (targetDeal.debtAmount > 0) !== (nextDebt > 0) || revertedFromCompleted;
        const updatedDeal: CRMDeal = {
          ...targetDeal,
          invoiceStatus,
          paidAmount: paidAmountRub,
          debtAmount: nextDebt,
          stage: revertedFromCompleted ? 'active' : targetDeal.stage,
          completedAt: revertedFromCompleted ? undefined : targetDeal.completedAt,
          archivedAt: revertedFromCompleted ? undefined : targetDeal.archivedAt,
          stageUpdatedAt: debtChanged ? nowIso : targetDeal.stageUpdatedAt
        };
        const next = debtChanged
          ? [updatedDeal, ...prev.filter(d => d.id !== sourceId)]
          : prev.map(d => (d.id === sourceId ? updatedDeal : d));
        persistDeals(next);
        return next;
      });
    }

    setClosingDocs(prev => {
      const next = prev.map(doc =>
        doc.sourceType === sourceType &&
        doc.sourceId === sourceId &&
        doc.kind === 'invoice'
          ? { ...doc, invoiceStatus, paidAmountRub }
          : doc
      );
      persistClosingDocs(next);
      return next;
    });

    dispatchStatusNotification({
      branchId,
      category: 'payment_status',
      title: `Статус счёта: ${INVOICE_STATUS_META[invoiceStatus].label}`,
      message: `${clientName} · оплачено ${paidAmountRub.toLocaleString('ru-RU')} из ${totalRub.toLocaleString('ru-RU')} ₽.`,
      entityLabel
    });
  };

  const handleUpdateNotificationSettings = (next: StatusNotificationSettings) => {
    setNotificationSettings(next);
    try {
      localStorage.setItem('specialtech_notification_settings', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleMarkNotificationsRead = () => {
    setStatusNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      try {
        localStorage.setItem('specialtech_status_notifications', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleToggleActSigned = (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const nextSigned = targetOrder ? !targetOrder.actSigned : true;
    setOrders(prev => {
      const next = prev.map(o =>
        o.id === orderId ? { ...o, actSigned: !o.actSigned } : o
      );
      persistOrders(next);
      return next;
    });
    if (targetOrder && notificationSettings.onActSignedChange) {
      dispatchStatusNotification({
        branchId: targetOrder.branchId,
        category: 'act_ks2',
        title: nextSigned ? 'Акт КС-2 подписан' : 'Акт КС-2 отозван',
        message: `Заказ ${targetOrder.orderNumber} (${targetOrder.clientName}) на сумму ${targetOrder.totalAmount.toLocaleString('ru-RU')} ₽.`,
        entityLabel: targetOrder.orderNumber
      });
    }
  };

  const handleApproveShift = (shiftId: string) => {
    if (!adminConfirmationAllowed || !hasActiveRequest) return;
    setShiftReports(prev => {
      const next = prev.map(s => (s.id === shiftId ? { ...s, status: 'approved' as const } : s));
      persistShiftReports(next);
      return next;
    });
  };

  const handleToggleAdminPermission = () => {
    setAdminConfirmationAllowed(prev => !prev);
  };

  const handleUpdateDriver = (updatedDriver: DriverProfile) => {
    setDrivers(prev => {
      const next = prev.map(d => (d.id === updatedDriver.id ? updatedDriver : d));
      try {
        localStorage.setItem('specialtech_drivers', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleAddDriver = (newDriver: DriverProfile) => {
    setDrivers(prev => {
      const next = [newDriver, ...prev];
      try {
        localStorage.setItem('specialtech_drivers', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleSetReplacement = (
    equipmentId: string,
    record: DriverReplacementRecord | null
  ) => {
    setDriverReplacements(prev => {
      const next = { ...prev };
      if (record === null) {
        delete next[equipmentId];
      } else {
        next[equipmentId] = record;
      }
      try {
        localStorage.setItem('specialtech_driver_replacements', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const formatNowTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const handleSendChatMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: `chat-${Date.now()}`,
      timestamp: formatNowTimestamp()
    };
    setChatMessages(prev => {
      const next = [...prev, newMsg];
      persistChatMessages(next);
      return next;
    });
  };

  const handleSendAttachmentToChat = (payload: {
    branchId: string;
    attachment: ChatAttachment;
    text: string;
    senderName: string;
  }) => {
    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      branchId: payload.branchId || activeBranch?.id || 'branch-hq',
      senderName: payload.senderName,
      senderRole: 'fleet_manager',
      text: payload.text,
      timestamp: formatNowTimestamp(),
      attachment: payload.attachment
    };
    setChatMessages(prev => {
      const next = [...prev, newMsg];
      persistChatMessages(next);
      return next;
    });
  };

  const handleConfirmWork = (payload: {
    type: ChatConfirmation['type'];
    value: string;
    shiftId?: string;
    equipmentId?: string;
    requestLabel?: string;
    comment?: string;
  }) => {
    if (!adminConfirmationAllowed || !hasActiveRequest) return;

    const targetShift = payload.shiftId
      ? shiftReports.find(s => s.id === payload.shiftId)
      : undefined;
    const targetEq = payload.equipmentId
      ? equipmentList.find(e => e.id === payload.equipmentId)
      : undefined;

    if (targetShift) {
      setShiftReports(prev => {
        const next = prev.map(s =>
          s.id === targetShift.id ? { ...s, status: 'approved' as const } : s
        );
        persistShiftReports(next);
        return next;
      });
    }

    const labelMap: Record<ChatConfirmation['type'], string> = {
      hours: 'Подтверждены часы работы',
      shift_close: 'Закрытие смены (ЭСМ-7)',
      volume_trips: 'Подтверждён объём (рейсы)'
    };

    const resolvedBranchId =
      targetShift?.branchId || targetEq?.branchId || activeBranch?.id || 'branch-hq';

    const confirmMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      branchId: resolvedBranchId,
      senderName: 'Администратор системы',
      senderRole: 'admin',
      text:
        payload.comment ||
        `${labelMap[payload.type]} (${payload.value})${
          payload.requestLabel ? ` по активной заявке «${payload.requestLabel}»` : ''
        }. Отметка зафиксирована с разрешения администратора.`,
      timestamp: formatNowTimestamp(),
      confirmation: {
        type: payload.type,
        label: labelMap[payload.type],
        value: payload.value,
        shiftNumber: targetShift?.shiftNumber,
        equipmentName: targetEq ? `[${targetEq.inventoryNumber}] ${targetEq.name}` : undefined,
        approvedByAdmin: true
      }
    };
    setChatMessages(prev => {
      const next = [...prev, confirmMsg];
      persistChatMessages(next);
      return next;
    });
  };

  const handleResolveAnomaly = (anomalyId: string) => {
    setAnomalies(prev => {
      const next = prev.map(a => (a.id === anomalyId ? { ...a, resolved: true } : a));
      persistAnomalies(next);
      return next;
    });
  };

  const handleEditEquipmentStatus = (eqId: string, newStatus: Equipment['status']) => {
    setEquipmentList(prev => {
      const next = prev.map(e => (e.id === eqId ? { ...e, status: newStatus } : e));
      persistEquipmentList(next);
      return next;
    });
    if (selectedEquipmentForDetail && selectedEquipmentForDetail.id === eqId) {
      setSelectedEquipmentForDetail(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleImportExcelData = (
    imported: {
      equipmentList: Equipment[];
      shiftReports: ShiftReport[];
      orders: RentalOrder[];
    },
    mode: 'merge' | 'replace',
    targetBranchId: string
  ) => {
    const resolvedBranchId =
      targetBranchId || activeBranch?.id || branches[0]?.id || 'branch-hq';
    const importedEquipment = (imported.equipmentList || []).map(e => ({
      ...e,
      branchId: resolvedBranchId
    }));
    const importedShifts = (imported.shiftReports || []).map(s => ({
      ...s,
      branchId: resolvedBranchId
    }));
    const importedOrders = (imported.orders || []).map(o => ({
      ...o,
      branchId: resolvedBranchId
    }));

    if (mode === 'replace') {
      if (importedEquipment.length) {
        setEquipmentList(prev => {
          const next = [
            ...prev.filter(e => e.branchId !== resolvedBranchId),
            ...importedEquipment
          ];
          persistEquipmentList(next);
          return next;
        });
      }
      if (importedShifts.length) {
        setShiftReports(prev => {
          const next = [
            ...prev.filter(s => s.branchId !== resolvedBranchId),
            ...importedShifts
          ];
          persistShiftReports(next);
          return next;
        });
      }
      if (importedOrders.length) {
        setOrders(prev => {
          const next = [
            ...prev.filter(o => o.branchId !== resolvedBranchId),
            ...importedOrders
          ];
          persistOrders(next);
          return next;
        });
      }
    } else {
      // Merge equipment within target branch only
      if (importedEquipment.length) {
        setEquipmentList(prev => {
          const map = new Map(prev.map(e => [`${e.branchId}::${e.inventoryNumber}`, e]));
          importedEquipment.forEach(e => {
            map.set(`${resolvedBranchId}::${e.inventoryNumber}`, e);
          });
          const next = Array.from(map.values());
          persistEquipmentList(next);
          return next;
        });
      }
      // Merge shifts within target branch
      if (importedShifts.length) {
        setShiftReports(prev => {
          const next = [...importedShifts, ...prev];
          persistShiftReports(next);
          return next;
        });
      }
      // Merge orders within target branch only
      if (importedOrders.length) {
        setOrders(prev => {
          const map = new Map(prev.map(o => [`${o.branchId}::${o.orderNumber}`, o]));
          importedOrders.forEach(o => {
            map.set(`${resolvedBranchId}::${o.orderNumber}`, o);
          });
          const next = Array.from(map.values());
          persistOrders(next);
          return next;
        });
      }
    }
  };

  const unresolvedAnomaliesCount = scopedAnomalies.filter(a => !a.resolved).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        equipmentList={scopedEquipment}
        anomalies={scopedAnomalies}
        branches={branches}
        activeBranchId={activeBranchId}
        onSelectBranch={handleSelectBranch}
        onOpenBranchesSettings={() => setCurrentTab('branches')}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onOpenDealModal={() => setIsDealModalOpen(true)}
        onOpenAiAnalyst={() => setCurrentTab('ai_analyst')}
        onOpenFleetManager={() => setCurrentTab('fleet_manager')}
        onOpenDashboard={() => setCurrentTab('dashboard')}
        adminConfirmationAllowed={adminConfirmationAllowed}
        onToggleAdminPermission={handleToggleAdminPermission}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* Main Body with Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          unresolvedAnomaliesCount={unresolvedAnomaliesCount}
          chatMessagesCount={scopedChatMessages.length}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          onOpenExcelExchange={() => setIsExcelModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-950">
          {currentTab === 'dashboard' && (
            <DashboardView
              equipmentList={scopedEquipment}
              anomalies={scopedAnomalies}
              shiftReports={scopedShiftReports}
              activeBranch={activeBranch}
              branches={branches}
              onSelectEquipment={setSelectedEquipmentForDetail}
              onOpenAiAnalyst={() => setCurrentTab('ai_analyst')}
              onNavigateToTab={setCurrentTab}
              onResolveAnomaly={handleResolveAnomaly}
              onSelectBranch={handleSelectBranch}
            />
          )}

          {currentTab === 'fleet_manager' && (
            <FleetManagerView
              branches={branches}
              activeBranch={activeBranch}
              equipmentList={equipmentList}
              deals={deals}
              orders={orders}
              shiftReports={shiftReports}
              drivers={drivers}
              replacements={driverReplacements}
              oneCConfig={oneCConfig}
              legalDocuments={legalDocuments}
              maxBotConfigs={maxBotConfigs}
              onUpdateMaxBotConfig={handleUpdateMaxBotConfig}
              onSaveBranch={handleSaveBranch}
              onSelectBranchWorkspace={(branchId) => {
                handleSelectBranch(branchId);
              }}
              onSubmitDeal={handleCreateDeal}
              onUpdateDeal={handleUpdateDeal}
              onSubmitShift={handleCreateShift}
              onModerateShift={handleModerateShift}
              onEditEquipmentStatus={handleEditEquipmentStatus}
              onUpdateEquipmentSite={handleUpdateEquipmentSite}
              onUpdateDriver={handleUpdateDriver}
              onAddDriver={handleAddDriver}
              onSetReplacement={handleSetReplacement}
              onSendChatMessage={handleSendChatMessage}
              onSendAttachmentToChat={handleSendAttachmentToChat}
              onOpenAdminPanel={() => setCurrentTab('admin_panel')}
              adminConfirmationAllowed={adminConfirmationAllowed}
              onToggleAdminPermission={handleToggleAdminPermission}
              onConfirmWork={handleConfirmWork}
              confirmRequest={fleetConfirmRequest}
              onOpenCrm={() => setCurrentTab('crm')}
              onOpenContract={handleOpenCustomerContract}
              onOpenCustomerChat={handleOpenCustomerChat}
            />
          )}

          {currentTab === 'fleet' && (
            <FleetView
              equipmentList={scopedEquipment}
              activeBranch={activeBranch}
              branches={branches}
              onSelectEquipment={setSelectedEquipmentForDetail}
              onAddEquipmentClick={() => {}}
              onOpenExcelExchange={() => setIsExcelModalOpen(true)}
            />
          )}

          {currentTab === 'rentals' && (
            <RentalsView
              orders={scopedOrders}
              equipmentList={scopedEquipment}
              activeBranch={activeBranch}
              branches={branches}
              oneCConfig={oneCConfig}
              savedClosingDocs={scopedClosingDocs}
              unreadNotificationsCount={
                (isIsolatedWorkspace
                  ? statusNotifications.filter(n => n.branchId === activeBranch?.id)
                  : statusNotifications
                ).filter(n => !n.read).length
              }
              onToggleActSigned={handleToggleActSigned}
              onOpenDealModal={() => setIsDealModalOpen(true)}
              onOpenClosingModal={setClosingModalTarget}
              onQuickSaveClosingDoc={handleSaveClosingDoc}
              onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
              onOpenNotificationSettings={() => setIsNotificationModalOpen(true)}
            />
          )}

          {currentTab === 'crm' && (
            <CrmView
              deals={scopedDeals}
              activeBranch={activeBranch}
              branches={branches}
              drivers={scopedDrivers}
              equipmentList={scopedEquipment}
              replacements={driverReplacements}
              oneCConfig={oneCConfig}
              savedClosingDocs={scopedClosingDocs}
              unreadNotificationsCount={
                (isIsolatedWorkspace
                  ? statusNotifications.filter(n => n.branchId === activeBranch?.id)
                  : statusNotifications
                ).filter(n => !n.read).length
              }
              adminConfirmationAllowed={adminConfirmationAllowed}
              onMoveDealStage={handleMoveDealStage}
              onOpenDealModal={() => setIsDealModalOpen(true)}
              onCloseDealShift={handleCloseDealShift}
              onCloseDealVolume={handleCloseDealVolume}
              onCloseShiftForDeal={(dealId) => {
                setFleetConfirmRequest({
                  dealId,
                  confirmType: 'shift_close',
                  nonce: Date.now()
                });
                setCurrentTab('fleet_manager');
              }}
              onOpenClosingModal={setClosingModalTarget}
              onQuickSaveClosingDoc={handleSaveClosingDoc}
              onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
              onOpenNotificationSettings={() => setIsNotificationModalOpen(true)}
            />
          )}

          {currentTab === 'timesheets' && (
            <TimesheetsView
              shiftReports={scopedShiftReports}
              equipmentList={scopedEquipment}
              drivers={scopedDrivers}
              activeBranch={activeBranch}
              branches={branches}
              tableConfig={adminConfig.tables.timesheets}
              adminConfirmationAllowed={adminConfirmationAllowed}
              hasActiveRequest={hasActiveRequest}
              onApproveShift={handleApproveShift}
              onUpdateDriver={handleUpdateDriver}
              onAddDriver={handleAddDriver}
            />
          )}

          {currentTab === 'chat' && (
            <ChatView
              messages={scopedChatMessages}
              deals={scopedDeals}
              activeBranch={activeBranch}
              branches={branches}
              orders={scopedOrders}
              equipmentList={scopedEquipment}
              drivers={scopedDrivers}
              shiftReports={scopedShiftReports}
              knowledgeDocs={docs}
              legalDocuments={legalDocuments}
              closingDocs={scopedClosingDocs}
              llmConfig={adminConfig.llm}
              requestedChatTarget={chatTargetRequest}
              onSendMessage={handleSendChatMessage}
            />
          )}

          {currentTab === 'ai_analyst' && (
            <AiAnalystView
              equipmentList={scopedEquipment}
              anomalies={scopedAnomalies}
              deals={scopedDeals}
              orders={scopedOrders}
              shiftReports={scopedShiftReports}
              oneCConfig={oneCConfig}
              activeBranch={activeBranch}
              llmConfig={adminConfig.llm}
            />
          )}

          {currentTab === 'contracts' && (
            <ContractsView
              documents={legalDocuments}
              history={legalHistory}
              knowledgeDocs={docs}
              branches={branches}
              activeBranch={activeBranch}
              currentRole={legalRole}
              onChangeRole={setLegalRole}
              onCreateDocument={handleCreateLegalDocument}
              onUpdateDocument={handleUpdateLegalDocument}
              onImportDocuments={handleImportLegalDocuments}
              onSaveToKnowledgeBase={handleSaveLegalDocToBase}
              onLogExport={handleLogLegalExport}
              onOpenKnowledgeBase={() => setCurrentTab('knowledge')}
              requestedTab={contractsTabRequest}
            />
          )}

          {currentTab === 'knowledge' && (
            <KnowledgeBaseView
              docs={docs}
              onOpenAiWithContext={() => {
                setCurrentTab('ai_analyst');
              }}
              onOpenContractsTemplates={(docCode) => {
                setContractsTabRequest({ tab: 'templates', docCode, nonce: Date.now() });
                setCurrentTab('contracts');
              }}
            />
          )}

          {currentTab === 'branches' && (
            <BranchesView
              branches={branches}
              activeBranchId={activeBranchId}
              equipmentList={equipmentList}
              deals={deals}
              orders={orders}
              onSelectBranchWorkspace={(branchId) => {
                handleSelectBranch(branchId);
                setCurrentTab('dashboard');
              }}
              onOpenFleetManager={(branchId) => {
                handleSelectBranch(branchId);
                setCurrentTab('fleet_manager');
              }}
              onSaveBranch={handleSaveBranch}
              onCreateBranch={handleCreateBranch}
            />
          )}

          {currentTab === 'admin_panel' && (
            <AdminPanelView
              config={adminConfig}
              knowledgeDocsCount={docs.length}
              branches={branches}
              equipmentList={equipmentList}
              onSaveConfig={handleSaveAdminConfig}
              onSaveBranch={handleSaveBranch}
              onUpdateEquipmentList={handleUpdateEquipmentList}
              onOpenKnowledgeBase={() => setCurrentTab('knowledge')}
            />
          )}

          {currentTab === 'integrations_1c' && (
            <Integrations1CView
              config={oneCConfig}
              onSaveConfig={handleSaveOneCConfig}
              branches={branches}
              onOpenBranches={() => setCurrentTab('branches')}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <QuickShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        equipmentList={scopedEquipment}
        drivers={scopedDrivers}
        deals={scopedDeals}
        orders={scopedOrders}
        replacements={driverReplacements}
        activeBranch={activeBranch}
        branches={branches}
        onSubmitShift={handleCreateShift}
        onSendChatNote={(payload) =>
          handleSendChatMessage({
            branchId: payload.branchId,
            senderName: payload.senderName,
            senderRole: 'driver',
            text: payload.text
          })
        }
        onOpenFleetManagerPanel={() => setCurrentTab('fleet_manager')}
        onOpenAdminPanel={() => setCurrentTab('admin_panel')}
      />

      <NewDealModal
        isOpen={isDealModalOpen}
        onClose={() => setIsDealModalOpen(false)}
        equipmentList={scopedEquipment}
        drivers={scopedDrivers}
        replacements={driverReplacements}
        deals={scopedDeals}
        orders={scopedOrders}
        branches={branches}
        activeBranch={activeBranch}
        oneCConfig={oneCConfig}
        onSubmitDeal={handleCreateDeal}
        onSendAttachmentToChat={handleSendAttachmentToChat}
        onSendChatMessage={handleSendChatMessage}
      />

      <EquipmentDetailModal
        equipment={selectedEquipmentForDetail}
        onClose={() => setSelectedEquipmentForDetail(null)}
        onEditStatus={handleEditEquipmentStatus}
      />

      <ExcelExchangeModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        data={{
          equipmentList,
          shiftReports,
          deals,
          orders,
          branches,
          activeBranch
        }}
        onImportData={handleImportExcelData}
      />

      <ClosingDocsModal
        target={closingModalTarget}
        equipmentList={scopedEquipment}
        branches={branches}
        oneCConfig={oneCConfig}
        savedClosingDocs={scopedClosingDocs}
        onClose={() => setClosingModalTarget(null)}
        onSaveClosingDoc={handleSaveClosingDoc}
        onCloseVolumeAndSign={handleCloseVolumeAndSign}
        onIssueInvoice={handleIssueInvoice}
        onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
      />

      <StatusNotificationSettingsModal
        isOpen={isNotificationModalOpen}
        settings={notificationSettings}
        notifications={
          isIsolatedWorkspace
            ? statusNotifications.filter(n => n.branchId === activeBranch?.id)
            : statusNotifications
        }
        onClose={() => setIsNotificationModalOpen(false)}
        onUpdateSettings={handleUpdateNotificationSettings}
        onMarkAllRead={handleMarkNotificationsRead}
      />

      {activeStatusToast && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-md bg-slate-900 border border-amber-500/50 rounded-xl shadow-2xl p-3 flex items-start gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white">{activeStatusToast.title}</div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              {activeStatusToast.message}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveStatusToast(null)}
            className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
