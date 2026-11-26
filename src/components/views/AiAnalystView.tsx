import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Wrench, 
  Users, 
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  Scale
} from 'lucide-react';
import {
  Equipment,
  AnomalyAlert,
  CRMDeal,
  RentalOrder,
  ShiftReport,
  OneCIntegrationConfig,
  FleetBranch,
  LlmAdminSettings
} from '../../types';
import {
  getBranchFixedOverheads,
  getBranchFixedOverheadsTotal
} from '../../utils/branchOverheads';

interface AiAnalystViewProps {
  equipmentList: Equipment[];
  anomalies: AnomalyAlert[];
  deals: CRMDeal[];
  orders: RentalOrder[];
  shiftReports: ShiftReport[];
  oneCConfig?: OneCIntegrationConfig;
  activeBranch?: FleetBranch | null;
  llmConfig?: LlmAdminSettings;
}

export const AiAnalystView: React.FC<AiAnalystViewProps> = ({
  equipmentList,
  anomalies,
  deals,
  orders,
  shiftReports,
  oneCConfig,
  activeBranch,
  llmConfig
}) => {
  const [activeAgent, setActiveAgent] = useState<'executive' | 'profitability' | 'audit' | 'crm' | 'maintenance' | 'legal'>('executive');
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Compute live operational context to pass to Gemini API
  const totalRevenue = equipmentList.reduce((sum, e) => sum + e.revenueMonth, 0);
  const totalDirectCosts = equipmentList.reduce((sum, e) => sum + e.fuelCostMonth + e.driverSalaryMonth + e.repairCostMonth + e.transportCostMonth, 0);
  const totalOverheads = equipmentList.reduce((sum, e) => sum + e.overheadsAllocated, 0);
  const totalOperatingProfit = totalRevenue - totalDirectCosts - totalOverheads;
  const averageMargin = totalRevenue > 0 ? (totalOperatingProfit / totalRevenue) * 100 : 0;
  const totalMonthHours = equipmentList.reduce((sum, e) => sum + e.monthHours, 0);
  const totalDowntimeHours = equipmentList.reduce((sum, e) => sum + e.downtimeHoursMonth, 0);
  const fleetUtilization = totalMonthHours > 0 ? (totalMonthHours / (equipmentList.length * 200)) * 100 : 0;
  const fleetDowntime = (totalMonthHours + totalDowntimeHours) > 0 ? (totalDowntimeHours / (totalMonthHours + totalDowntimeHours)) * 100 : 0;
  const totalDebtor = deals.reduce((sum, d) => sum + d.debtAmount, 0);

  const contextData = {
    branch: activeBranch
      ? {
          code: activeBranch.code,
          name: activeBranch.name,
          city: activeBranch.city,
          fleetManager: activeBranch.fleetManagerName,
          oneCDepartmentCode: activeBranch.documentFlow.oneCDepartmentCode,
          fixedOverheadsMonthlyRub: getBranchFixedOverheadsTotal(activeBranch),
          fixedOverheadsBreakdown: getBranchFixedOverheads(activeBranch).map(o => ({
            category: o.category,
            name: o.name,
            monthlyAmountRub: o.monthlyAmountRub
          }))
        }
      : { code: 'ALL', name: 'Консолидация всех участков и филиалов' },
    summary: {
      fleetCount: equipmentList.length,
      totalRevenue,
      totalDirectCosts,
      totalOperatingProfit,
      averageMargin,
      fleetUtilization,
      fleetDowntime,
      totalDebtor
    },
    topUnits: equipmentList.map(e => ({
      inv: e.inventoryNumber,
      name: e.name,
      type: e.type,
      status: e.status,
      hours: e.monthHours,
      rate: e.hourlyRate,
      revenue: e.revenueMonth,
      directCosts: e.fuelCostMonth + e.driverSalaryMonth + e.repairCostMonth + e.transportCostMonth,
      downtimeHours: e.downtimeHoursMonth,
      maintenanceDueIn: e.nextMaintenanceInHours
    })),
    anomalies: anomalies.filter(a => !a.resolved).map(a => ({
      title: a.title,
      desc: a.description,
      impact: a.impactRubles
    })),
    accounting1C: oneCConfig
      ? {
          ipSubject: oneCConfig.subjects.ip_specialtechnica.entityName,
          oooSubject: oneCConfig.subjects.ooo_specialtech.entityName,
          routing: oneCConfig.routing
        }
      : undefined
  };

  // Preset executive queries from Section 8 of the blueprint
  const presetQueries = [
    {
      agent: 'executive',
      label: 'Ежедневная сводка дня для руководителя',
      query: 'Сформируй комплексную управленческую сводку для генерального директора: ключевые цифры за день, загрузка техники, простои и риски.'
    },
    {
      agent: 'profitability',
      label: 'Какая техника приносит максимальную прибыль?',
      query: 'Какая техника показала максимальную чистую прибыль и доходность на час? Сравни категории экскаваторов и кранов.'
    },
    {
      agent: 'audit',
      label: 'Анализ простоев > 20% и аномалий в сменных рапортах',
      query: 'Выяви машины с критическим уровнем простоев и проанализируй подозрительные рапорты машинистов по наработке и расходу топлива.'
    },
    {
      agent: 'crm',
      label: 'Аудит дебиторской задолженности и воронки',
      query: 'Проанализируй задолженность заказчиков: где есть просрочка, какие акты не подписаны и кому приостановить подачу техники?'
    },
    {
      agent: 'maintenance',
      label: 'Где растут расходы на ТО и ремонт?',
      query: 'Проведи анализ технического состояния парка: у каких единиц техники аномально растут затраты на ремонт и кому срочно требуется ТО?'
    },
    {
      agent: 'legal',
      label: 'Юридический аудит договоров и претензий',
      query: 'Проверь юридические риски по действующим договорам, актам ЭСМ-7/простоям, подготовь претензии должникам и проверь разделение сделок между ООО «SpecialTech» и ИП «SpecialTechnica».'
    }
  ];

  const handleRunAnalysis = async (queryToRun?: string, agentTypeToRun?: typeof activeAgent) => {
    const q = queryToRun || userQuery || 'Сформируй комплексный аналитический отчёт';
    const agent = agentTypeToRun || activeAgent;

    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const response = await fetch(llmConfig?.proxyEndpoint || '/api/ai-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          agentType: agent,
          contextData,
          llmConfig: llmConfig
            ? {
                model: llmConfig.model,
                maxOutputTokens: llmConfig.maxOutputTokens,
                temperature: llmConfig.temperature,
                topP: llmConfig.topP,
                systemInstructionSuffix: llmConfig.systemInstructionSuffix
              }
            : undefined
        })
      });

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setAnalysisResult(resJson.data);
      }
    } catch (err) {
      console.error('AI Analyst error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    const text = `SpecialTech AI ERP — Аналитический отчёт
Роль: ${analysisResult.role}
Резюме: ${analysisResult.executiveSummary}

Ключевые выводы:
${analysisResult.keyFindings?.map((f: string) => `• ${f}`).join('\n')}

Управленческие решения:
${analysisResult.actionableSteps?.map((s: string) => `→ ${s}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Title & Introduction */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-[14px] uppercase font-mono text-amber-400 font-semibold tracking-wider">
              Gemini 4 Hydrogen · Multi-Agent Orchestrator
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI-Бизнес-Аналитик, Операционный Контролёр и Юрист
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            Глубокий анализ рентабельности парка, поиск потерь маржи, аудит путевых листов, юридическая экспертиза договоров и маршрутизация 1С
          </p>
        </div>
      </div>

      {/* Multi-Agent Role Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        {[
          { id: 'executive', label: 'Executive Agent', desc: 'Сводка директора', icon: Bot },
          { id: 'profitability', label: 'Аналитик прибыли', desc: 'Рентабельность и KPI', icon: TrendingUp },
          { id: 'audit', label: 'Контролёр смен', desc: 'Аномалии ГСМ и часы', icon: ShieldAlert },
          { id: 'crm', label: 'CRM & Дебиторка', desc: 'Заказчики и оплаты', icon: Users },
          { id: 'maintenance', label: 'Куратор ТО', desc: 'Ремонты и ресурс', icon: Wrench },
          { id: 'legal', label: 'AI-Юрист', desc: 'Договоры, ЭСМ-7, 1С', icon: Scale },
        ].map(agent => {
          const Icon = agent.icon;
          const isActive = activeAgent === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => {
                setActiveAgent(agent.id as any);
                handleRunAnalysis(undefined, agent.id as any);
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[14px] font-bold ${isActive ? 'text-amber-400' : 'text-slate-200'}`}>
                  {agent.label}
                </span>
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <span className="text-xs text-slate-400">{agent.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Preset Query Chips */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide block">
          Частые управленческие вопросы (Пресеты):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {presetQueries.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveAgent(item.agent as any);
                setUserQuery(item.query);
                handleRunAnalysis(item.query, item.agent as any);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 text-[14px] transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Prompt Input */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
        <label className="block text-xs font-medium text-slate-300">
          Задать произвольный вопрос аналитику:
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Например: Сравни рентабельность гусеничных экскаваторов и автокранов с учётом расходов на трал..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunAnalysis();
            }}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[14px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => handleRunAnalysis()}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[14px] transition cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Анализировать</span>
          </button>
        </div>
      </div>

      {/* AI Analysis Result Card */}
      {isLoading && (
        <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 className="text-sm font-bold text-white">Идёт расчёт операционных метрик и формул...</h3>
          <p className="text-[14px] text-slate-400 max-w-md mx-auto">
            Оркестратор собирает SQL-агрегаты выручки, проверяет договоры, путевые листы на аномалии и строит управленческие инсайты через Gemini 4 Hydrogen.
          </p>
        </div>
      )}

      {analysisResult && !isLoading && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-xl relative">
          {/* Header of Report */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{analysisResult.role}</h3>
                <span className="text-[13px] text-slate-400">
                  {activeBranch
                    ? `Участок ${activeBranch.name} (Fleet Manager: ${activeBranch.fleetManagerName}) · ${equipmentList.length} ед. техники`
                    : `Консолидированный отчёт по ${equipmentList.length} ед. техники всех участков`}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[14px] font-medium transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано' : 'Копировать отчёт'}</span>
            </button>
          </div>

          {/* Executive Summary */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
            <span className="text-[14px] font-bold text-amber-400 uppercase tracking-wide block mb-1">
              Управленческое резюме (Executive Summary)
            </span>
            <p className="text-[14px] text-slate-200 leading-relaxed">
              {analysisResult.executiveSummary}
            </p>
          </div>

          {/* Key Findings with numbers */}
          {analysisResult.keyFindings && (
            <div className="space-y-1.5">
              <h4 className="text-[14px] font-bold text-slate-300 uppercase tracking-wide">
                Ключевые факты и выявленные отклонения:
              </h4>
              <div className="space-y-1.5">
                {analysisResult.keyFindings.map((finding: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[14px] text-slate-200 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                    <span className="text-amber-400 font-bold font-mono">0{i + 1}.</span>
                    <span className="leading-relaxed">{finding}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculated Metrics Grid */}
          {analysisResult.calculatedMetrics && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                Расчётные показатели (Строгий программный расчёт):
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(analysisResult.calculatedMetrics).map(([k, v]: [string, any], idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">{k}</span>
                    <span className="text-base font-bold text-white num-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Steps (Управленческие решения) */}
          {analysisResult.actionableSteps && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-950 to-emerald-950/10 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-[14px] font-bold text-emerald-300 uppercase tracking-wide">
                  Рекомендуемые управленческие решения (Что сделать прямо сейчас):
                </h4>
              </div>
              <ul className="space-y-1 text-[14px]">
                {analysisResult.actionableSteps.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-slate-200">
                    <span className="font-bold text-emerald-400 font-mono">#{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Initial state before analysis */}
      {!analysisResult && !isLoading && (
        <div className="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <Bot className="w-12 h-12 text-amber-400 mx-auto opacity-80" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">Готов к анализу данных спецтехники</h3>
            <p className="text-[14px] text-slate-400 mt-1">
              Выберите интересующую роль агента выше или задайте любой вопрос по выручке, простоям, зарплатам или контрактам.
            </p>
          </div>
          <button
            onClick={() => handleRunAnalysis(presetQueries[0].query, 'executive')}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[14px] shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            Сформировать сводку директора прямо сейчас
          </button>
        </div>
      )}
    </div>
  );
};
