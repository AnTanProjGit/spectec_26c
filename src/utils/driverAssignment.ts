import {
  DriverProfile,
  DriverReplacementRecord,
  DriverShiftRoster,
  Equipment
} from '../types';

export const SHIFT_ROSTER_LABELS: Record<DriverShiftRoster, string> = {
  shift_1: 'Смена 1 (дневная по табелю)',
  shift_2: 'Смена 2 (сменный экипаж по табелю)'
};

export interface DriverResolutionResult {
  mode: 'default_single' | 'timesheet_shift' | 'manager_replacement' | 'unassigned';
  resolvedDriver: DriverProfile | null;
  boundDrivers: DriverProfile[];
  requiresManagerSelection: boolean;
  replacementRecord?: DriverReplacementRecord;
  explanation: string;
}

/**
 * Схема определения водителя-машиниста при вызове единицы техники в CRM и в форме смены:
 * 1) Если требуется замена / назначена замена Fleet Manager или директором (админом) — применяется замена;
 * 2) Если привязан 1 водитель-машинист — определяется по умолчанию;
 * 3) Если водителей несколько — происходит выбор смены по табелю.
 */
export function resolveDriverForEquipment(
  equipment: Equipment | undefined,
  drivers: DriverProfile[],
  replacements: Record<string, DriverReplacementRecord>,
  preferredShift: DriverShiftRoster = 'shift_1'
): DriverResolutionResult {
  if (!equipment) {
    return {
      mode: 'unassigned',
      resolvedDriver: null,
      boundDrivers: [],
      requiresManagerSelection: false,
      explanation: 'Техника не выбрана.'
    };
  }

  const branchDrivers = drivers.filter(d => d.branchId === equipment.branchId);
  const boundDrivers = branchDrivers.filter(d =>
    d.assignedEquipmentIds.includes(equipment.id)
  );
  const replacement = replacements[equipment.id];

  // 1. Explicit replacement assigned by Fleet Manager of the branch
  if (replacement) {
    const replacementDriver =
      branchDrivers.find(d => d.id === replacement.driverId) || null;
    if (replacementDriver) {
      const roleLabel =
        replacement.setByRole === 'director_admin'
          ? 'директором (админ-панель)'
          : 'Fleet Manager участка';
      return {
        mode: 'manager_replacement',
        resolvedDriver: replacementDriver,
        boundDrivers,
        requiresManagerSelection: false,
        replacementRecord: replacement,
        explanation: `Замена назначена ${roleLabel}: ${replacement.driverName} (${replacement.driverPhone}).`
      };
    }
  }

  // 2. Check if any bound driver is flagged as needing replacement
  const activeDrivers = boundDrivers.filter(d => !d.needsReplacement);
  const flaggedDrivers = boundDrivers.filter(d => d.needsReplacement);

  if (boundDrivers.length === 0) {
    return {
      mode: 'unassigned',
      resolvedDriver: null,
      boundDrivers: [],
      requiresManagerSelection: true,
      explanation:
        'Водитель не привязан. Назначьте водителя (телефон + ФИО) в «Поле Fleet Manager» своего участка.'
    };
  }

  if (activeDrivers.length === 0) {
    return {
      mode: 'manager_replacement',
      resolvedDriver: null,
      boundDrivers,
      requiresManagerSelection: true,
      explanation: `Водителю (${flaggedDrivers.map(d => d.name).join(', ')}) требуется замена — выбор устанавливает Fleet Manager своего участка.`
    };
  }

  // 3. Single bound driver -> assigned by default
  if (boundDrivers.length === 1 && activeDrivers.length === 1) {
    const single = activeDrivers[0];
    return {
      mode: 'default_single',
      resolvedDriver: single,
      boundDrivers,
      requiresManagerSelection: false,
      explanation: `Привязан 1 машинист — выбран по умолчанию: ${single.name} (${single.phone}).`
    };
  }

  // 4. Multiple bound drivers -> select shift by timesheet
  const matchingShiftDriver =
    activeDrivers.find(d => d.shiftRoster === preferredShift) ||
    activeDrivers[0];

  const replacementNotice =
    flaggedDrivers.length > 0
      ? ` (основной водитель ${flaggedDrivers[0].name} требует замены — доступен перевод)`
      : '';

  return {
    mode: 'timesheet_shift',
    resolvedDriver: matchingShiftDriver,
    boundDrivers,
    requiresManagerSelection: false,
    explanation: `Экипаж из ${boundDrivers.length} водителей — выбор по табелю (${SHIFT_ROSTER_LABELS[matchingShiftDriver.shiftRoster]}): ${matchingShiftDriver.name}${replacementNotice}.`
  };
}
