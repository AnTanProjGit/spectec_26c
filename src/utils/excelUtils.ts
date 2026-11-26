import * as XLSX from 'xlsx';
import { Equipment, ShiftReport, CRMDeal, RentalOrder, FleetBranch } from '../types';
import { ConsolidatedBranchSummary } from './periodAnalytics';

export interface ERPFullData {
  equipmentList: Equipment[];
  shiftReports: ShiftReport[];
  deals: CRMDeal[];
  orders: RentalOrder[];
  branches?: FleetBranch[];
  activeBranch?: FleetBranch | null;
}

/**
 * Maps type identifiers to Russian readable labels
 */
const typeLabels: Record<string, string> = {
  excavator: 'Экскаватор',
  crane: 'Автокран',
  dump_truck: 'Самосвал',
  loader: 'Погрузчик',
  bulldozer: 'Бульдозер',
  cherry_picker: 'Автовышка'
};

const reverseTypeLabels: Record<string, string> = {
  'экскаватор': 'excavator',
  'автокран': 'crane',
  'кран': 'crane',
  'самосвал': 'dump_truck',
  'погрузчик': 'loader',
  'бульдозер': 'bulldozer',
  'автовышка': 'cherry_picker',
  'вышка': 'cherry_picker'
};

const statusLabels: Record<string, string> = {
  rented: 'В аренде (в работе)',
  available: 'Свободна',
  maintenance: 'В ТО / Ремонте',
  reserve: 'Резерв'
};

const reverseStatusLabels: Record<string, string> = {
  'в аренде (в работе)': 'rented',
  'в аренде': 'rented',
  'в работе': 'rented',
  'свободна': 'available',
  'свободен': 'available',
  'в то / ремонте': 'maintenance',
  'в ремонте': 'maintenance',
  'то': 'maintenance',
  'ремонт': 'maintenance',
  'резерв': 'reserve'
};

/**
 * Creates and downloads an Excel workbook (.xlsx)
 */
export function exportToExcel(
  data: ERPFullData, 
  scope: 'all' | 'fleet' | 'shifts' | 'orders' = 'all'
): void {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().split('T')[0];

  // 1. Sheet: Парк техники
  if (scope === 'all' || scope === 'fleet') {
    const fleetRows = data.equipmentList.map(eq => {
      const directCosts = eq.fuelCostMonth + eq.driverSalaryMonth + eq.repairCostMonth + eq.transportCostMonth;
      const profit = eq.revenueMonth - directCosts - eq.overheadsAllocated;
      const margin = eq.revenueMonth > 0 ? (profit / eq.revenueMonth) * 100 : 0;
      const branch = data.branches?.find(b => b.id === eq.branchId);

      return {
        'Участок / Филиал': branch ? `${branch.name} (${branch.code})` : eq.branchId,
        'Инв. номер': eq.inventoryNumber,
        'Наименование': eq.name,
        'Тип': typeLabels[eq.type] || eq.type,
        'Марка': eq.brand,
        'Гос. номер': eq.plateNumber,
        'VIN': eq.vin,
        'Год': eq.year,
        'Собственник': eq.owner,
        'Балансовая ст-ть (₽)': eq.currentValue,
        'Статус': statusLabels[eq.status] || eq.status,
        'Текущий объект': eq.assignedSite || 'База / Не назначен',
        'Машинист': eq.assignedOperator || 'Не назначен',
        'Моточасы (всего)': eq.currentHours,
        'Часы за месяц': eq.monthHours,
        'Ставка (₽/ч)': eq.hourlyRate,
        'Расход ГСМ (л/ч)': eq.fuelRateHour,
        'Выручка за месяц (₽)': eq.revenueMonth,
        'Топливо (₽)': eq.fuelCostMonth,
        'Зарплата машиниста (₽)': eq.driverSalaryMonth,
        'ТО и ремонт (₽)': eq.repairCostMonth,
        'Трал / доставка (₽)': eq.transportCostMonth,
        'Накладные (₽)': eq.overheadsAllocated,
        'Чистая прибыль (₽)': profit,
        'Маржа (%)': parseFloat(margin.toFixed(1)),
        'Простой (ч)': eq.downtimeHoursMonth,
        'До ТО (м/ч)': eq.nextMaintenanceInHours,
        'Грузоподъёмность / объём': eq.specs.capacity || '',
        'Стрела / ковш': eq.specs.boomLength || eq.specs.bucketVolume || '',
        'Эксплуатационный вес': eq.specs.weight,
        'Примечание': eq.notes || ''
      };
    });

    const fleetWs = XLSX.utils.json_to_sheet(fleetRows);
    fleetWs['!cols'] = [
      { wch: 12 }, { wch: 26 }, { wch: 15 }, { wch: 14 }, { wch: 14 },
      { wch: 18 }, { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 20 },
      { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, fleetWs, 'Парк техники');
  }

  // 2. Sheet: Сменные рапорты
  if (scope === 'all' || scope === 'shifts') {
    const paymentLabels: Record<string, string> = {
      fuel_own_tank: 'ГСМ свой бак',
      fuel_for_equipment: 'ГСМ для техники парка',
      parts: 'Запчасти',
      other: 'Другое'
    };

    const shiftRows = data.shiftReports.map(sh => {
      const eq = data.equipmentList.find(e => e.id === sh.equipmentId);
      const targetEq = sh.paymentTargetEquipmentId
        ? data.equipmentList.find(e => e.id === sh.paymentTargetEquipmentId)
        : undefined;
      return {
        '№ Рапорта': sh.shiftNumber,
        'Дата смены': sh.date,
        'Инв. номер': eq?.inventoryNumber || sh.equipmentId,
        'Техника': eq?.name || '',
        'Машинист': sh.operatorName,
        'Карта водителя': sh.cardLast4 ? `**** ${sh.cardLast4}` : '',
        'Заказчик': sh.clientName || '',
        'Объект': sh.siteName,
        'Начало работы': sh.workStartTime || '',
        'Окончание работы': sh.workEndTime || '',
        'Перегон (ч)': sh.relocationHours ?? 0,
        'Счётчик старт': sh.startHours,
        'Счётчик финиш': sh.endHours,
        'Отработано часов': sh.workHours,
        'Простой (ч)': sh.downtimeHours,
        'Причина простоя': sh.downtimeReason || 'Нет',
        'Заправлено (л)': sh.fuelLitersAdded,
        'Удельный расход (л/ч)': sh.fuelHourlyCalculated,
        'Платежи (корп. карта)': sh.paymentCategory ? paymentLabels[sh.paymentCategory] || sh.paymentCategory : '',
        'Получатель ГСМ': targetEq ? `[${targetEq.inventoryNumber}] ${targetEq.name}` : '',
        'Сумма по карте (₽)': sh.paymentAmountRub ?? 0,
        'Путевой лист': sh.waybillGenerated ? 'Сформирован' : 'Нет',
        'Фото счётчика': sh.photoVerified ? 'Да' : 'Нет',
        'Статус проверки': sh.status === 'anomaly' ? 'Аномалия' : 'Утверждено',
        'Замечания': sh.anomalyMessage || '',
        'З/П машиниста (₽)': sh.calculatedSalary
      };
    });

    const shiftWs = XLSX.utils.json_to_sheet(shiftRows);
    shiftWs['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 20 },
      { wch: 16 }, { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 26 }, { wch: 14 },
      { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 16 }, { wch: 35 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, shiftWs, 'Сменные рапорты');
  }

  // 3. Sheet: Договоры аренды
  if (scope === 'all' || scope === 'orders') {
    const orderRows = data.orders.map(ord => {
      const eq = data.equipmentList.find(e => e.id === ord.equipmentId);
      const debt = ord.totalAmount - ord.paidAmount;
      return {
        '№ Договора / Заказа': ord.orderNumber,
        'Заказчик': ord.clientName,
        'Инв. номер техники': eq?.inventoryNumber || '',
        'Техника': eq?.name || '',
        'Машинист': ord.operatorName,
        'Адрес объекта': ord.siteAddress,
        'Дата начала': ord.startDate,
        'Дата окончания': ord.endDate,
        'План часов': ord.plannedHours,
        'Факт часов': ord.actualHours,
        'Ставка (₽/ч)': ord.hourlyRate,
        'Сумма заказа (₽)': ord.totalAmount,
        'Оплачено (₽)': ord.paidAmount,
        'Дебиторская задолженность (₽)': debt,
        'Акт КС-2 подписан': ord.actSigned ? 'Да' : 'Ожидает подписи'
      };
    });

    const orderWs = XLSX.utils.json_to_sheet(orderRows);
    orderWs['!cols'] = [
      { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 24 }, { wch: 20 },
      { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, orderWs, 'Договоры аренды');
  }

  // 4. Sheet: Сводка P&L
  if (scope === 'all') {
    const totalRev = data.equipmentList.reduce((s, e) => s + e.revenueMonth, 0);
    const totalFuel = data.equipmentList.reduce((s, e) => s + e.fuelCostMonth, 0);
    const totalSalary = data.equipmentList.reduce((s, e) => s + e.driverSalaryMonth, 0);
    const totalRepairs = data.equipmentList.reduce((s, e) => s + e.repairCostMonth, 0);
    const totalTransport = data.equipmentList.reduce((s, e) => s + e.transportCostMonth, 0);
    const totalDirect = totalFuel + totalSalary + totalRepairs + totalTransport;
    const totalOverheads = data.equipmentList.reduce((s, e) => s + e.overheadsAllocated, 0);
    const totalProfit = totalRev - totalDirect - totalOverheads;
    const margin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
    const totalHours = data.equipmentList.reduce((s, e) => s + e.monthHours, 0);

    const summaryRows = [
      { 'Финансовый показатель': 'Количество техники в парке', 'Значение': `${data.equipmentList.length} ед.`, 'Методика расчёта': 'Фактический реестр ОС' },
      { 'Финансовый показатель': 'Всего отработано моточасов за месяц', 'Значение': `${totalHours} м/ч`, 'Методика расчёта': 'Сумма по табелям смен' },
      { 'Финансовый показатель': 'Валовая выручка (Revenue)', 'Значение': `${totalRev.toLocaleString()} ₽`, 'Методика расчёта': 'Часы × Почасовая ставка по актам' },
      { 'Финансовый показатель': 'Прямые затраты на дизельное топливо', 'Значение': `${totalFuel.toLocaleString()} ₽`, 'Методика расчёта': 'Фактический расход ГСМ' },
      { 'Финансовый показатель': 'Сдельная оплата труда машинистов', 'Значение': `${totalSalary.toLocaleString()} ₽`, 'Методика расчёта': 'Тарифная сетка по рапортам' },
      { 'Финансовый показатель': 'Расходы на ТО, ремонт и запчасти', 'Значение': `${totalRepairs.toLocaleString()} ₽`, 'Методика расчёта': 'Счета сервиса и склад' },
      { 'Финансовый показатель': 'Транспортировка тралом и доставка', 'Значение': `${totalTransport.toLocaleString()} ₽`, 'Методика расчёта': 'Перебазировка техники' },
      { 'Финансовый показатель': 'Итого прямых расходов (Direct Costs)', 'Значение': `${totalDirect.toLocaleString()} ₽`, 'Методика расчёта': 'Топливо + З/П + Ремонт + Трал' },
      { 'Финансовый показатель': 'Распределённые накладные расходы', 'Значение': `${totalOverheads.toLocaleString()} ₽`, 'Методика расчёта': 'База, диспетчеризация, лизинг' },
      { 'Финансовый показатель': 'Операционная прибыль (Operating Profit)', 'Значение': `${totalProfit.toLocaleString()} ₽`, 'Методика расчёта': 'Revenue - DirectCosts - Overheads' },
      { 'Финансовый показатель': 'Рентабельность по операционной прибыли', 'Значение': `${margin.toFixed(1)}%`, 'Методика расчёта': '(Profit / Revenue) × 100' },
      { 'Финансовый показатель': 'Средняя себестоимость 1 моточаса', 'Значение': `${(totalHours > 0 ? Math.round(totalDirect / totalHours) : 0).toLocaleString()} ₽/ч`, 'Методика расчёта': 'DirectCosts / MonthHours' }
    ];

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Сводка P&L');
  }

  // Trigger browser download
  const branchTag = data.activeBranch ? `_${data.activeBranch.code}` : '_ALL';
  const filename = `SpecialTech_ERP${branchTag}_${scope}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Parses an Excel (.xlsx/.xls) ArrayBuffer or File
 */
export function parseExcelFile(
  arrayBuffer: ArrayBuffer,
  defaultBranchId: string = 'branch-hq',
  shiftPrefix: string = 'SH-',
  branchEquipment: Equipment[] = []
): {
  success: boolean;
  error?: string;
  data?: {
    equipmentList: Equipment[];
    shiftReports: ShiftReport[];
    orders: RentalOrder[];
  };
} {
  try {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { success: false, error: 'Файл Excel пуст или повреждён' };
    }

    const equipmentList: Equipment[] = [];
    const shiftReports: ShiftReport[] = [];
    const orders: RentalOrder[] = [];

    // Helper to find sheet by name substring (case-insensitive)
    const findSheet = (keywords: string[]) => {
      const match = wb.SheetNames.find(name => 
        keywords.some(k => name.toLowerCase().includes(k.toLowerCase()))
      );
      return match ? wb.Sheets[match] : null;
    };

    // 1. Parse Equipment Sheet
    const fleetSheet = findSheet(['парк', 'техник', 'fleet', 'equipment']) || wb.Sheets[wb.SheetNames[0]];
    if (fleetSheet) {
      const rawRows: any[] = XLSX.utils.sheet_to_json(fleetSheet, { defval: '' });
      rawRows.forEach((row, idx) => {
        // Look for inventory number or name
        const inv = String(row['Инв. номер'] || row['Инвентарный номер'] || row['InventoryNumber'] || row['Инв. №'] || '').trim();
        const name = String(row['Наименование'] || row['Название'] || row['Модель'] || row['Name'] || '').trim();

        if (!inv && !name) return; // skip empty rows

        const rawType = String(row['Тип'] || row['Type'] || 'excavator').toLowerCase().trim();
        const type = (reverseTypeLabels[rawType] || rawType || 'excavator') as any;

        const rawStatus = String(row['Статус'] || row['Status'] || 'available').toLowerCase().trim();
        const status = (reverseStatusLabels[rawStatus] || 'available') as any;

        const purchasePrice = parseFloat(row['Цена покупки'] || row['Покупная стоимость'] || row['PurchasePrice']) || 12000000;
        const currentValue = parseFloat(row['Балансовая ст-ть (₽)'] || row['Балансовая стоимость'] || row['CurrentValue']) || 10000000;
        const currentHours = parseFloat(row['Моточасы (всего)'] || row['Моточасы'] || row['CurrentHours']) || 2000;
        const monthHours = parseFloat(row['Часы за месяц'] || row['Наработка за месяц'] || row['MonthHours']) || 150;
        const hourlyRate = parseFloat(row['Ставка (₽/ч)'] || row['Ставка'] || row['HourlyRate']) || 3200;
        const fuelRateHour = parseFloat(row['Расход ГСМ (л/ч)'] || row['Норма ГСМ'] || row['FuelRateHour']) || 16;
        const revenueMonth = parseFloat(row['Выручка за месяц (₽)'] || row['Выручка'] || row['RevenueMonth']) || (monthHours * hourlyRate);
        const fuelCostMonth = parseFloat(row['Топливо (₽)'] || row['FuelCostMonth']) || (monthHours * fuelRateHour * 65);
        const driverSalaryMonth = parseFloat(row['Зарплата машиниста (₽)'] || row['DriverSalaryMonth']) || (monthHours * 550);
        const repairCostMonth = parseFloat(row['ТО и ремонт (₽)'] || row['RepairCostMonth']) || 25000;
        const transportCostMonth = parseFloat(row['Трал / доставка (₽)'] || row['TransportCostMonth']) || 15000;
        const overheadsAllocated = parseFloat(row['Накладные (₽)'] || row['OverheadsAllocated']) || 35000;
        const downtimeHoursMonth = parseFloat(row['Простой (ч)'] || row['DowntimeHoursMonth']) || 10;
        const nextMaintenanceInHours = parseFloat(row['До ТО (м/ч)'] || row['До ТО'] || row['NextMaintenanceInHours']) || 150;

        equipmentList.push({
          id: `eq-xlsx-${Date.now()}-${idx}`,
          branchId: defaultBranchId,
          inventoryNumber: inv || `EXC-${Math.floor(Math.random() * 80 + 10)}`,
          name: name || 'Спецтехника',
          type,
          brand: String(row['Марка'] || row['Brand'] || 'СпецМаш'),
          plateNumber: String(row['Гос. номер'] || row['Госномер'] || row['PlateNumber'] || 'A 000 AA 777'),
          vin: String(row['VIN'] || 'KMTPC210X' + Math.floor(Math.random() * 900000 + 100000)),
          year: parseInt(row['Год'] || row['Год выпуска'] || '2022') || 2022,
          owner: String(row['Собственник'] || 'Собственный парк'),
          purchasePrice,
          currentValue,
          status,
          assignedSite: String(row['Текущий объект'] || row['Объект'] || row['AssignedSite'] || ''),
          assignedOperator: String(row['Машинист'] || row['Экипаж'] || row['AssignedOperator'] || ''),
          currentHours,
          monthHours,
          hourlyRate,
          fuelRateHour,
          fuelCostMonth,
          driverSalaryMonth,
          repairCostMonth,
          transportCostMonth,
          overheadsAllocated,
          revenueMonth,
          downtimeHoursMonth,
          nextMaintenanceInHours,
          specs: {
            capacity: String(row['Грузоподъёмность / объём'] || '20 т'),
            boomLength: String(row['Стрела / ковш'] || ''),
            weight: String(row['Эксплуатационный вес'] || '20 000 кг')
          },
          notes: String(row['Примечание'] || '')
        });
      });
    }

    // 2. Parse Shift Sheet if present
    const shiftSheet = findSheet(['смен', 'рапорт', 'shift', 'timesheet']);
    if (shiftSheet) {
      const candidateBranchEquipment = [
        ...equipmentList.filter(e => e.branchId === defaultBranchId),
        ...branchEquipment.filter(e => e.branchId === defaultBranchId)
      ];
      const rawShifts: any[] = XLSX.utils.sheet_to_json(shiftSheet, { defval: '' });
      rawShifts.forEach((row, idx) => {
        const shiftNumber = String(row['№ Рапорта'] || row['Рапорт'] || row['ShiftNumber'] || `${shiftPrefix}${idx + 500}`);
        const date = String(row['Дата смены'] || row['Дата'] || row['Date'] || new Date().toISOString().split('T')[0]);
        const rowInv = String(row['Инв. номер'] || row['Инвентарный номер'] || row['Инв. №'] || row['InventoryNumber'] || '').trim().toLowerCase();
        const rowEqName = String(row['Техника'] || row['Наименование'] || '').trim().toLowerCase();
        const matchedEq =
          candidateBranchEquipment.find(e => rowInv && e.inventoryNumber.toLowerCase() === rowInv) ||
          candidateBranchEquipment.find(e => rowEqName && e.name.toLowerCase() === rowEqName) ||
          candidateBranchEquipment[0];
        const startHours = parseFloat(row['Счётчик старт'] || row['Старт'] || row['StartHours']) || 4000;
        const endHours = parseFloat(row['Счётчик финиш'] || row['Финиш'] || row['EndHours']) || startHours + 10;
        const workHours = parseFloat(row['Отработано часов'] || row['Часы'] || row['WorkHours']) || Math.max(0, endHours - startHours);
        const downtimeHours = parseFloat(row['Простой (ч)'] || row['DowntimeHours']) || 0;
        const fuelLitersAdded = parseFloat(row['Заправлено (л)'] || row['FuelLitersAdded']) || 150;
        const fuelHourlyCalculated = parseFloat(row['Удельный расход (л/ч)'] || row['FuelHourlyCalculated']) || (workHours > 0 ? fuelLitersAdded / workHours : 15);
        const calculatedSalary = parseFloat(row['З/П машиниста (₽)'] || row['CalculatedSalary']) || (workHours * 550);
        const isAnomaly = String(row['Статус проверки'] || '').toLowerCase().includes('аномал');

        shiftReports.push({
          id: `sh-xlsx-${Date.now()}-${idx}`,
          branchId: defaultBranchId,
          shiftNumber,
          date,
          equipmentId: matchedEq?.id || '',
          operatorName: String(row['Машинист'] || 'Машинист'),
          siteName: String(row['Объект'] || 'Строительный объект'),
          startHours,
          endHours,
          workHours,
          downtimeHours,
          downtimeReason: String(row['Причина простоя'] || ''),
          fuelLitersAdded,
          fuelHourlyCalculated: parseFloat(fuelHourlyCalculated.toFixed(1)),
          photoVerified: true,
          status: isAnomaly ? 'anomaly' : 'approved',
          anomalyMessage: String(row['Замечания'] || ''),
          calculatedSalary
        });
      });
    }

    if (equipmentList.length === 0 && shiftReports.length === 0) {
      return {
        success: false,
        error: 'В загруженном файле Excel не найдено подходящих строк с данными спецтехники или сменных рапортов.'
      };
    }

    return {
      success: true,
      data: {
        equipmentList,
        shiftReports,
        orders
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Ошибка чтения Excel файла: ${err.message || 'Некорректный формат .xlsx'}`
    };
  }
}

/**
 * Generates and downloads a clean Excel template (.xlsx) for import
 */
export function downloadSampleExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  const sampleFleet = [
    {
      'Инв. номер': 'EXC-28',
      'Наименование': 'Hitachi ZX200-5G (Гусеничный)',
      'Тип': 'Экскаватор',
      'Марка': 'Hitachi',
      'Гос. номер': 'M 781 TT 777',
      'VIN': 'JHMZX200X00192841',
      'Год': 2023,
      'Собственник': 'ООО «СпецТехЛизинг»',
      'Балансовая ст-ть (₽)': 14800000,
      'Статус': 'В аренде (в работе)',
      'Текущий объект': 'ЖК «Северный парк»',
      'Машинист': 'Макаров Е. В.',
      'Моточасы (всего)': 1840,
      'Часы за месяц': 160,
      'Ставка (₽/ч)': 3500,
      'Расход ГСМ (л/ч)': 16.8,
      'Выручка за месяц (₽)': 560000,
      'Топливо (₽)': 174720,
      'Зарплата машиниста (₽)': 88000,
      'ТО и ремонт (₽)': 24000,
      'Трал / доставка (₽)': 20000,
      'Накладные (₽)': 40000,
      'До ТО (м/ч)': 160,
      'Грузоподъёмность / объём': '20 т / ковш 1.0 м³',
      'Стрела / ковш': '5.68 м',
      'Эксплуатационный вес': '19 800 кг',
      'Примечание': 'Новая машина после лизинговой поставки'
    },
    {
      'Инв. номер': 'CRN-14',
      'Наименование': 'Zoomlion ZTC300V (30т)',
      'Тип': 'Автокран',
      'Марка': 'Zoomlion',
      'Гос. номер': 'C 334 MK 799',
      'VIN': 'LZTC300V9928174',
      'Год': 2023,
      'Собственник': 'Собственный парк',
      'Балансовая ст-ть (₽)': 13200000,
      'Статус': 'Свободна',
      'Текущий объект': 'База Южная',
      'Машинист': 'Смирнов В. А.',
      'Моточасы (всего)': 1250,
      'Часы за месяц': 140,
      'Ставка (₽/ч)': 3200,
      'Расход ГСМ (л/ч)': 14.2,
      'Выручка за месяц (₽)': 448000,
      'Топливо (₽)': 129220,
      'Зарплата машиниста (₽)': 77000,
      'ТО и ремонт (₽)': 18000,
      'Трал / доставка (₽)': 15000,
      'Накладные (₽)': 35000,
      'До ТО (м/ч)': 250,
      'Грузоподъёмность / объём': '30 т',
      'Стрела / ковш': '42 м',
      'Эксплуатационный вес': '32 000 кг',
      'Примечание': 'Готов к подаче на объект'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleFleet);
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 20 },
    { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 16 },
    { wch: 18 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Парк техники');

  XLSX.writeFile(wb, 'SpecialTech_Шаблон_Импорта_Техники.xlsx');
}

export function exportBranchesSummaryToExcel(
  summary: ConsolidatedBranchSummary,
  periodLabel: string
): void {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().split('T')[0];

  // Sheet 1: Расходы и прибыли по участкам
  const profitRows = summary.branchRows.map(r => ({
    'Код участка': r.branch.code,
    'Участок / Филиал': r.branch.name,
    'Руководитель (Fleet Manager)': r.branch.fleetManagerName,
    'Техника (ед.)': r.equipmentCount,
    'Наработка (м.ч)': r.hours,
    'Загрузка (%)': Number(r.utilizationPct.toFixed(1)),
    'Выручка (₽)': r.revenue,
    'Прямые расходы (₽)': r.directCosts,
    'Постоянные расходы участка (₽)': r.fixedOverheadsTotal,
    'Накладные парка (₽)': r.equipmentOverheads,
    'Всего расходы (₽)': r.totalExpenses,
    'Валовая прибыль (₽)': r.grossProfit,
    'Валовая маржа (%)': Number(r.grossMarginPct.toFixed(1)),
    'Операционная прибыль (₽)': r.operatingProfit,
    'Операционная маржа (%)': Number(r.operatingMarginPct.toFixed(1)),
    'Доля в выручке (%)': Number(r.revenueSharePct.toFixed(1)),
    'Доля в прибыли (%)': Number(r.profitSharePct.toFixed(1))
  }));

  profitRows.push({
    'Код участка': 'ИТОГО',
    'Участок / Филиал': `Сводно по предприятию (${periodLabel})`,
    'Руководитель (Fleet Manager)': 'Все руководители',
    'Техника (ед.)': summary.totals.equipmentCount,
    'Наработка (м.ч)': summary.totals.hours,
    'Загрузка (%)': Number(summary.totals.utilizationPct.toFixed(1)),
    'Выручка (₽)': summary.totals.revenue,
    'Прямые расходы (₽)': summary.totals.directCosts,
    'Постоянные расходы участка (₽)': summary.totals.fixedOverheadsTotal,
    'Накладные парка (₽)': summary.totals.equipmentOverheads,
    'Всего расходы (₽)': summary.totals.totalExpenses,
    'Валовая прибыль (₽)': summary.totals.grossProfit,
    'Валовая маржа (%)': Number(summary.totals.grossMarginPct.toFixed(1)),
    'Операционная прибыль (₽)': summary.totals.operatingProfit,
    'Операционная маржа (%)': Number(summary.totals.operatingMarginPct.toFixed(1)),
    'Доля в выручке (%)': 100,
    'Доля в прибыли (%)': 100
  });

  const wsProfits = XLSX.utils.json_to_sheet(profitRows);
  wsProfits['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 20 },
    { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsProfits, 'Прибыли по участкам');

  // Sheet 2: Детализация расходов по статьям и участкам
  const buildExpenseRow = (
    group: string,
    title: string,
    getter: (r: (typeof summary.branchRows)[number]) => number,
    totalVal: number
  ) => {
    const row: Record<string, string | number> = {
      'Группа затрат': group,
      'Статья расходов': title
    };
    summary.branchRows.forEach(r => {
      row[`[${r.branch.code}] ${r.branch.name} (₽)`] = getter(r);
    });
    row['Сводно Итого (₽)'] = totalVal;
    row['Доля в расходах (%)'] =
      summary.totals.totalExpenses > 0
        ? Number(((totalVal / summary.totals.totalExpenses) * 100).toFixed(1))
        : 0;
    return row;
  };

  const expenseRows = [
    buildExpenseRow('Прямые', 'Дизельное топливо (ГСМ)', r => r.fuelCost, summary.totals.fuelCost),
    buildExpenseRow('Прямые', 'Зарплата машинистов (сдельщина)', r => r.salaryCost, summary.totals.salaryCost),
    buildExpenseRow('Прямые', 'Запчасти, ТО и ремонты', r => r.repairCost, summary.totals.repairCost),
    buildExpenseRow('Прямые', 'Трал и доставка на объект', r => r.transportCost, summary.totals.transportCost),
    buildExpenseRow('Прямые', 'Субподряд (привлечённая техника)', r => r.subcontractCost, summary.totals.subcontractCost),
    buildExpenseRow('Итого прямые', 'Итого прямые расходы', r => r.directCosts, summary.totals.directCosts),
    buildExpenseRow('Постоянные участка', 'Зарплата офис и ИТР', r => r.fixedByCategory.office_itr_salary, summary.totals.fixedByCategory.office_itr_salary),
    buildExpenseRow('Постоянные участка', 'АХЧ (офис, бытовки, канцелярия)', r => r.fixedByCategory.aho, summary.totals.fixedByCategory.aho),
    buildExpenseRow('Постоянные участка', 'Лизинг спецтехники и транспорта', r => r.fixedByCategory.leasing, summary.totals.fixedByCategory.leasing),
    buildExpenseRow('Постоянные участка', 'Налоги и обязательные сборы', r => r.fixedByCategory.taxes, summary.totals.fixedByCategory.taxes),
    buildExpenseRow('Постоянные участка', 'Прочие постоянные (охрана, медик, ПО)', r => r.fixedByCategory.other, summary.totals.fixedByCategory.other),
    buildExpenseRow('Накладные парка', 'Накладные, аллоцированные на парк', r => r.equipmentOverheads, summary.totals.equipmentOverheads),
    buildExpenseRow('Итого накладные', 'Итого постоянные и накладные', r => r.totalOverheads, summary.totals.totalOverheads),
    buildExpenseRow('ВСЕГО', 'Всего совокупные расходы', r => r.totalExpenses, summary.totals.totalExpenses)
  ];

  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
  wsExpenses['!cols'] = [
    { wch: 20 },
    { wch: 36 },
    ...summary.branchRows.map(() => ({ wch: 24 })),
    { wch: 20 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Расходы по участкам');

  // Sheet 3: Сводный расчёт (ОПиУ)
  const buildPnlRow = (
    step: string,
    getter: (r: (typeof summary.branchRows)[number]) => number,
    totalVal: number,
    isPercentOfRevenue = true
  ) => {
    const row: Record<string, string | number> = {
      'Показатель (ОПиУ)': step
    };
    summary.branchRows.forEach(r => {
      row[`[${r.branch.code}] ${r.branch.name}`] = getter(r);
    });
    row['Сводно по предприятию'] = totalVal;
    row['Доля от выручки (%)'] = isPercentOfRevenue && summary.totals.revenue > 0
      ? Number(((totalVal / summary.totals.revenue) * 100).toFixed(1))
      : '-';
    return row;
  };

  const pnlRows = [
    buildPnlRow('1. Валовая выручка (Revenue)', r => r.revenue, summary.totals.revenue),
    buildPnlRow('2. Прямые операционные расходы', r => r.directCosts, summary.totals.directCosts),
    buildPnlRow('3. Валовая прибыль (1 - 2)', r => r.grossProfit, summary.totals.grossProfit),
    buildPnlRow('4. Постоянные расходы участков', r => r.fixedOverheadsTotal, summary.totals.fixedOverheadsTotal),
    buildPnlRow('5. Накладные расходы на парк', r => r.equipmentOverheads, summary.totals.equipmentOverheads),
    buildPnlRow('6. Итого постоянные и накладные (4 + 5)', r => r.totalOverheads, summary.totals.totalOverheads),
    buildPnlRow('7. Всего расходы (2 + 6)', r => r.totalExpenses, summary.totals.totalExpenses),
    buildPnlRow('8. Операционная прибыль (1 - 7)', r => r.operatingProfit, summary.totals.operatingProfit),
    buildPnlRow('9. Средняя прибыль на 1 ед. техники (₽)', r => r.profitPerUnit, summary.totals.profitPerUnit, false),
    buildPnlRow('10. Выручка на 1 машино-час (₽/ч)', r => r.revenuePerHour, summary.totals.revenuePerHour, false),
    buildPnlRow('11. Себестоимость 1 машино-часа (₽/ч)', r => r.totalCostPerHour, summary.totals.totalCostPerHour, false)
  ];

  const wsPnl = XLSX.utils.json_to_sheet(pnlRows);
  wsPnl['!cols'] = [
    { wch: 38 },
    ...summary.branchRows.map(() => ({ wch: 24 })),
    { wch: 24 },
    { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPnl, 'Сводный расчёт');

  XLSX.writeFile(wb, `SpecialTech_Сводный_Расчёт_Участки_${dateStr}.xlsx`);
}

