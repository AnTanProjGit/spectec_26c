import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  FileCheck,
  Table,
  MapPin
} from 'lucide-react';
import { Equipment, ShiftReport, RentalOrder } from '../types';
import { 
  exportToExcel, 
  parseExcelFile, 
  downloadSampleExcelTemplate,
  ERPFullData 
} from '../utils/excelUtils';

interface ExcelExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ERPFullData;
  onImportData: (
    imported: {
      equipmentList: Equipment[];
      shiftReports: ShiftReport[];
      orders: RentalOrder[];
    },
    mode: 'merge' | 'replace',
    targetBranchId: string
  ) => void;
}

export const ExcelExchangeModal: React.FC<ExcelExchangeModalProps> = ({
  isOpen,
  onClose,
  data,
  onImportData
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportScope, setExportScope] = useState<'all' | 'fleet' | 'shifts' | 'orders'>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    data.activeBranch?.id || data.branches?.[0]?.id || 'branch-hq'
  );

  // Import state
  const [parsedData, setParsedData] = useState<{
    equipmentList: Equipment[];
    shiftReports: ShiftReport[];
    orders: RentalOrder[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [dragActive, setDragActive] = useState(false);
  const [importedSuccessMsg, setImportedSuccessMsg] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedBranchId(data.activeBranch?.id || data.branches?.[0]?.id || 'branch-hq');
    setParsedData(null);
    setImportError(null);
    setImportedSuccessMsg(null);
    setSelectedFileName(null);
  }, [isOpen, data.activeBranch, data.branches]);

  const targetBranch = useMemo(
    () =>
      data.activeBranch ||
      data.branches?.find(b => b.id === selectedBranchId) ||
      data.branches?.[0] ||
      null,
    [data.activeBranch, data.branches, selectedBranchId]
  );

  const targetBranchId = targetBranch?.id || selectedBranchId;

  const branchScopedData: ERPFullData = useMemo(
    () => ({
      equipmentList: data.equipmentList.filter(e => e.branchId === targetBranchId),
      shiftReports: data.shiftReports.filter(s => s.branchId === targetBranchId),
      deals: data.deals.filter(d => d.branchId === targetBranchId),
      orders: data.orders.filter(o => o.branchId === targetBranchId),
      branches: data.branches,
      activeBranch: targetBranch
    }),
    [data, targetBranchId, targetBranch]
  );

  if (!isOpen) return null;

  const handleDownloadExcel = () => {
    exportToExcel(branchScopedData, exportScope);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportedSuccessMsg(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (!buffer) return;

      const res = parseExcelFile(
        buffer,
        targetBranchId,
        targetBranch?.documentFlow.shiftPrefix || 'SH-',
        branchScopedData.equipmentList
      );
      if (res.success && res.data) {
        setParsedData(res.data);
      } else {
        setImportError(res.error || 'Не удалось распознать структуру Excel');
        setParsedData(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportedSuccessMsg(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (!buffer) return;

      const res = parseExcelFile(
        buffer,
        targetBranchId,
        targetBranch?.documentFlow.shiftPrefix || 'SH-',
        branchScopedData.equipmentList
      );
      if (res.success && res.data) {
        setParsedData(res.data);
      } else {
        setImportError(res.error || 'Не удалось распознать структуру Excel');
        setParsedData(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSimulateSampleImport = () => {
    setSelectedFileName('SpecialTech_Парк_Поставка_2026.xlsx');
    setImportError(null);
    setImportedSuccessMsg(null);

    const branchCode = targetBranch?.code || 'MSK';

    // Provide sample equipment to test import immediately
    const sampleUnits: Equipment[] = [
      {
        id: `eq-imported-1-${Date.now()}`,
        branchId: targetBranchId,
        inventoryNumber: `${branchCode}-EXC-28`,
        name: 'Hitachi ZX200-5G (Гусеничный 20т)',
        type: 'excavator',
        brand: 'Hitachi',
        plateNumber: 'M 781 TT 777',
        vin: 'JHMZX200X00192841',
        year: 2023,
        owner: 'ООО «СпецТехЛизинг»',
        purchasePrice: 16500000,
        currentValue: 14800000,
        status: 'available',
        assignedSite: 'База Дзержинский (Центральная)',
        assignedOperator: 'Макаров Е. В.',
        currentHours: 1840,
        monthHours: 160,
        hourlyRate: 3500,
        fuelRateHour: 16.8,
        fuelCostMonth: 174720,
        driverSalaryMonth: 88000,
        repairCostMonth: 24000,
        transportCostMonth: 20000,
        overheadsAllocated: 40000,
        revenueMonth: 560000,
        downtimeHoursMonth: 6,
        nextMaintenanceInHours: 160,
        specs: { capacity: '20 т / ковш 1.0 м³', weight: '19 800 кг' },
        notes: 'Импортировано из ведомости Excel (Парк 2026)'
      },
      {
        id: `eq-imported-2-${Date.now()}`,
        branchId: targetBranchId,
        inventoryNumber: `${branchCode}-CRN-14`,
        name: 'Zoomlion ZTC300V (Автокран 30т)',
        type: 'crane',
        brand: 'Zoomlion',
        plateNumber: 'C 334 MK 799',
        vin: 'LZTC300V9928174',
        year: 2023,
        owner: 'Собственный парк',
        purchasePrice: 14900000,
        currentValue: 13200000,
        status: 'available',
        assignedSite: 'База Южная',
        assignedOperator: 'Смирнов В. А.',
        currentHours: 1250,
        monthHours: 140,
        hourlyRate: 3200,
        fuelRateHour: 14.2,
        fuelCostMonth: 129220,
        driverSalaryMonth: 77000,
        repairCostMonth: 18000,
        transportCostMonth: 15000,
        overheadsAllocated: 35000,
        revenueMonth: 448000,
        downtimeHoursMonth: 8,
        nextMaintenanceInHours: 250,
        specs: { capacity: '30 т / стрела 42 м', weight: '32 000 кг' },
        notes: 'Импортировано из ведомости Excel (Парк 2026)'
      }
    ];

    setParsedData({
      equipmentList: sampleUnits,
      shiftReports: [],
      orders: []
    });
  };

  const handleExecuteImport = () => {
    if (!parsedData) return;

    onImportData(parsedData, importMode, targetBranchId);
    const count = (parsedData.equipmentList?.length || 0) + (parsedData.shiftReports?.length || 0);
    setImportedSuccessMsg(
      `Успешно импортировано ${count} записей на участок [${targetBranch?.code || targetBranchId}]!`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Обмен данными Excel (.xlsx)
              </h3>
              <p className="text-[14px] text-slate-400">
                Выгрузка и загрузка ведомостей спецтехники, сменных рапортов и расчёта рентабельности
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Export vs Import */}
        <div className="flex border-b border-slate-800 px-6 pt-3 bg-slate-950/20 gap-4">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-3 text-xs font-bold transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'export'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Выгрузка в Excel (.xlsx) [Экспорт]</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 text-xs font-bold transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'import'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Загрузка из Excel (.xlsx) [Импорт]</span>
          </button>
        </div>

        {/* Branch Target Strip (Excel exchange strictly per branch) */}
        <div className="mx-6 mt-3 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Выгрузка и загрузка строго по участку:</span>
          </div>
          {data.activeBranch ? (
            <span className="font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30">
              [{data.activeBranch.code}] {data.activeBranch.name}
            </span>
          ) : (
            <select
              value={targetBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setParsedData(null);
                setImportedSuccessMsg(null);
              }}
              aria-label="Выбор конкретного участка для обмена Excel"
              className="bg-slate-900 border border-emerald-500/40 rounded-lg px-3 py-1 text-xs font-medium text-emerald-200 focus:outline-none focus:border-emerald-400"
            >
              {(data.branches || []).map(b => (
                <option key={b.id} value={b.id}>
                  [{b.code}] {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* TAB 1: EXPORT */}
        {activeTab === 'export' && (
          <div className="p-4 space-y-2.5 text-xs">
            {/* Scope Selection Cards */}
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Выберите состав формируемого Excel-файла (.xlsx) для участка [{targetBranch?.code || 'MSK'}]:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { 
                    id: 'all', 
                    label: 'Полная книга ERP', 
                    desc: '4 листа: Парк, Смены, Заказы, P&L',
                    badge: `${branchScopedData.equipmentList.length} машин + смены`
                  },
                  { 
                    id: 'fleet', 
                    label: 'Парк спецтехники', 
                    desc: 'Лист с карточками и экономикой',
                    badge: `${branchScopedData.equipmentList.length} машин`
                  },
                  { 
                    id: 'shifts', 
                    label: 'Сменные рапорты', 
                    desc: 'Табели моточасов и зарплат',
                    badge: `${branchScopedData.shiftReports.length} смен`
                  },
                  { 
                    id: 'orders', 
                    label: 'Договоры и акты', 
                    desc: 'Контракты, акты КС-2 и оплаты',
                    badge: `${branchScopedData.orders.length} заказов`
                  }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExportScope(item.id as any)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      exportScope === item.id
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-[14px]">{item.label}</span>
                      <span className="text-xs text-slate-400 mt-1 block">{item.desc}</span>
                    </div>
                    <span className="text-xs text-emerald-400/90 font-mono mt-2 block font-semibold">
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Structure Preview */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold text-[14px] flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-400" />
                  <span>Структура выгружаемой книги Microsoft Excel:</span>
                </span>
                <span className="font-mono text-[13px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Формат: OpenXML (.xlsx)
                </span>
              </div>

              <div className="space-y-1.5 text-[13px] text-slate-400">
                <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-white font-medium">📄 Лист «Парк техники»</span>
                  <span className="text-slate-400 font-mono">29 колонок: Инв. №, Модель, VIN, Ставка, Часы, Выручка, Себестоимость, Маржа %, До ТО</span>
                </div>
                {(exportScope === 'all' || exportScope === 'shifts') && (
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-white font-medium">📄 Лист «Сменные рапорты»</span>
                    <span className="text-slate-400 font-mono">17 колонок: № Рапорта, Дата, Моточасы старт/финиш, Простои, ГСМ, З/П экипажа</span>
                  </div>
                )}
                {(exportScope === 'all' || exportScope === 'orders') && (
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-white font-medium">📄 Лист «Договоры аренды»</span>
                    <span className="text-slate-400 font-mono">15 колонок: Договор, Заказчик, План/факт часов, Суммы, Оплаты, Дебиторка, КС-2</span>
                  </div>
                )}
                {exportScope === 'all' && (
                  <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-white font-medium">📄 Лист «Сводка P&L»</span>
                    <span className="text-slate-400 font-mono">Итоговая финансовая ведомость: Валовая выручка, Топливо, Ремонты, Прибыль</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[13px] text-slate-400">
                Сгенерированный файл на 100% совместим с Microsoft Excel, LibreOffice Calc и Google Таблицами.
              </div>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Скачать файл Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IMPORT */}
        {activeTab === 'import' && (
          <div className="p-4 space-y-2.5 text-xs">
            {/* Drag and drop upload container */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`p-7 rounded-2xl border-2 border-dashed text-center transition flex flex-col items-center justify-center space-y-2.5 ${
                dragActive 
                  ? 'border-emerald-400 bg-emerald-500/10' 
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-10 h-10 text-emerald-400 opacity-90" />
              <div>
                <p className="text-sm font-bold text-white">
                  Перетащите файл Excel (.xlsx или .xls) сюда
                </p>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  Поддерживаются ведомости парка техники, путевые листы и таблицы наработки
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <label className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-500/20 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" />
                  <span>Выбрать .xlsx файл</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  title="Скачать чистый предзаполненный шаблон Excel для заполнения"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Скачать шаблон .xlsx</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateSampleImport}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  title="Загрузить тестовую партию спецтехники из Excel"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Загрузить тестовый пример</span>
                </button>
              </div>

              {selectedFileName && (
                <div className="text-[13px] font-mono text-emerald-400 pt-1">
                  Выбранный файл: <strong>{selectedFileName}</strong>
                </div>
              )}
            </div>

            {/* Parsing Result & Preview Table */}
            {importError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[14px] block">Ошибка чтения Excel:</span>
                  <p className="text-[13px] text-rose-200/90 leading-relaxed mt-0.5">{importError}</p>
                </div>
              </div>
            )}

            {parsedData && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[14px]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Файл Excel успешно прочитан и структурирован!</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                    Распознано: {parsedData.equipmentList.length} ед. техники, {parsedData.shiftReports.length} смен
                  </span>
                </div>

                {/* Quick Preview Table of parsed items */}
                {parsedData.equipmentList.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-emerald-500/20 bg-slate-950/80">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase text-[9px]">
                        <tr>
                          <th className="py-2 px-3">Инв. №</th>
                          <th className="py-2 px-3">Наименование</th>
                          <th className="py-2 px-3">Тип</th>
                          <th className="py-2 px-3">Ставка (₽/ч)</th>
                          <th className="py-2 px-3">Часы/мес</th>
                          <th className="py-2 px-3">Объект</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {parsedData.equipmentList.slice(0, 4).map((eq, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-mono font-bold text-amber-400">{eq.inventoryNumber}</td>
                            <td className="py-2 px-3 font-medium text-white">{eq.name}</td>
                            <td className="py-2 px-3 text-slate-400">{eq.type}</td>
                            <td className="py-2 px-3 font-mono">{eq.hourlyRate} ₽</td>
                            <td className="py-2 px-3 font-mono">{eq.monthHours} ч</td>
                            <td className="py-2 px-3 text-slate-400 truncate max-w-[140px]">{eq.assignedSite || 'База'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {importedSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-medium text-[14px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{importedSuccessMsg}</span>
              </div>
            )}

            {/* Import Mode and Confirm Bar */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="text-slate-400 font-medium text-[11px]">Режим импорта:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-xs">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="accent-emerald-500"
                  />
                  <span>Дополнить существующий парк (Merge)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-xs">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-emerald-500"
                  />
                  <span>Заменить все записи</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!parsedData || parsedData.equipmentList.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                <span>Импортировать данные в систему</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
