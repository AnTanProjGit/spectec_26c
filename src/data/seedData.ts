import {
  Equipment,
  CRMDeal,
  RentalOrder,
  ShiftReport,
  AnomalyAlert,
  KnowledgeDoc,
  FleetBranch,
  ChatMessage,
  DriverProfile,
  LegalDocument,
  LegalHistoryEntry
} from '../types';

export const initialBranches: FleetBranch[] = [
  {
    id: 'branch-hq',
    code: 'MSK',
    name: 'Главный парк (Москва и МО)',
    city: 'Москва и МО',
    isHeadquarters: true,
    fleetManagerName: 'Орлов П. С.',
    fleetManagerPhone: '+7 (495) 700-12-01',
    chiefMechanicName: 'Григорьев А. Н.',
    chiefMechanicPhone: '+7 (495) 700-12-08',
    baseAddress: 'МО, г. Дзержинский, ул. Энергетиков, д. 14',
    regularClients: [
      'ООО «Монолит-Строй»',
      'АО «Автодор-Инвест»',
      'ООО «ГрандСтройИнвест»',
      'ООО «ДорСтройХолдинг»',
      'ГК «Пионер Развитие»'
    ],
    documentFlow: {
      isolatedStreams: true,
      isolateCrmAndErp: true,
      orderPrefix: 'RO-MSK-',
      waybillPrefix: 'ПЛ-МСК-',
      shiftPrefix: 'SH-MSK-',
      actPrefix: 'КС2-МСК-',
      oneCDepartmentCode: 'ПОДР-МСК-01',
      default1CSubject: 'ooo_specialtech'
    },
    fixedOverheads: [
      {
        id: 'ovh-sal-hq',
        category: 'office_itr_salary',
        name: 'Зарплата офис и ИТР (Fleet Manager, ИТР, бухгалтерия)',
        monthlyAmountRub: 400000
      },
      {
        id: 'ovh-aho-hq',
        category: 'aho',
        name: 'Аренда офиса, бытовки, канцелярия и оргтехника',
        monthlyAmountRub: 185000
      },
      {
        id: 'ovh-leasing-hq',
        category: 'leasing',
        name: 'Лизинг спецтехники и автопарка',
        monthlyAmountRub: 320000
      },
      {
        id: 'ovh-taxes-hq',
        category: 'taxes',
        name: 'Налоги и обязательные сборы участка',
        monthlyAmountRub: 115000
      },
      {
        id: 'ovh-oth-hq',
        category: 'other',
        name: 'Охрана, предрейсовый медик и ПО/ГЛОНАСС',
        monthlyAmountRub: 85000
      }
    ]
  },
  {
    id: 'branch-kzn',
    code: 'KZN',
    name: 'Филиал «Поволжье» (Казань)',
    city: 'г. Казань и РТ',
    isHeadquarters: false,
    fleetManagerName: 'Волков И. А.',
    fleetManagerPhone: '+7 (843) 290-45-18',
    chiefMechanicName: 'Зарипов Р. Ф.',
    chiefMechanicPhone: '+7 (843) 290-45-24',
    baseAddress: 'г. Казань, ул. Техническая, д. 52, база №2',
    regularClients: [
      'ООО «ТатСтройМост»',
      'АО «КазаньПромИнвест»',
      'ООО «ВолгаДорСервис»',
      'ООО «Иннополис-Строй»'
    ],
    documentFlow: {
      isolatedStreams: true,
      isolateCrmAndErp: true,
      orderPrefix: 'RO-KZN-',
      waybillPrefix: 'ПЛ-КЗН-',
      shiftPrefix: 'SH-KZN-',
      actPrefix: 'КС2-КЗН-',
      oneCDepartmentCode: 'ПОДР-КЗН-02',
      default1CSubject: 'ooo_specialtech'
    },
    fixedOverheads: [
      {
        id: 'ovh-sal-kzn',
        category: 'office_itr_salary',
        name: 'Зарплата офис и ИТР (Fleet Manager, ИТР, бухгалтерия)',
        monthlyAmountRub: 255000
      },
      {
        id: 'ovh-aho-kzn',
        category: 'aho',
        name: 'Аренда офиса, бытовки, канцелярия и оргтехника',
        monthlyAmountRub: 95000
      },
      {
        id: 'ovh-leasing-kzn',
        category: 'leasing',
        name: 'Лизинг спецтехники филиала',
        monthlyAmountRub: 180000
      },
      {
        id: 'ovh-taxes-kzn',
        category: 'taxes',
        name: 'Налоги и сборы филиала',
        monthlyAmountRub: 65000
      },
      {
        id: 'ovh-oth-kzn',
        category: 'other',
        name: 'Охрана, медик и ГЛОНАСС',
        monthlyAmountRub: 45000
      }
    ]
  }
];

export const initialEquipmentList: Equipment[] = [
  {
    id: 'eq-1',
    branchId: 'branch-hq',
    inventoryNumber: 'EXC-14',
    name: 'Komatsu PC210NLC-8',
    type: 'excavator',
    brand: 'Komatsu',
    plateNumber: 'E 384 CB 777',
    vin: 'KMTPC210X8849201',
    year: 2021,
    owner: 'ООО «СпецТехЛизинг»',
    purchasePrice: 15800000,
    currentValue: 12400000,
    status: 'rented',
    assignedSite: 'ЖК «Северный квартал» (Москва)',
    assignedOperator: 'Соколов В. П.',
    currentHours: 5420,
    monthHours: 194,
    mileageKmMonth: 0,
    hourlyRate: 3400,
    fuelRateHour: 17.5,
    fuelCostMonth: 186000,
    driverSalaryMonth: 106700,
    repairCostMonth: 68000,
    transportCostMonth: 25000,
    subcontractCostMonth: 38000,
    overheadsAllocated: 45000,
    revenueMonth: 659600,
    downtimeHoursMonth: 24,
    nextMaintenanceInHours: 80,
    specs: {
      capacity: '22 т',
      bucketVolume: '1.2 м³',
      weight: '22 100 кг'
    },
    notes: 'Зафиксирован рост затрат на ремонт гидроразводки. Простой 24 ч из-за ожидания согласования земляных работ.'
  },
  {
    id: 'eq-2',
    branchId: 'branch-hq',
    inventoryNumber: 'CRN-02',
    name: 'Liebherr LTM 1050-3.1 (50т)',
    type: 'crane',
    brand: 'Liebherr',
    plateNumber: 'M 719 AO 777',
    vin: 'W09LTM1050J991204',
    year: 2020,
    owner: 'Собственный парк',
    purchasePrice: 32000000,
    currentValue: 26500000,
    status: 'rented',
    assignedSite: 'Мостовой переход р. Десна (М-3)',
    assignedOperator: 'Кузнецов А. М.',
    currentHours: 4120,
    monthHours: 182,
    mileageKmMonth: 620,
    hourlyRate: 4800,
    fuelRateHour: 16.0,
    fuelCostMonth: 160000,
    driverSalaryMonth: 127400,
    repairCostMonth: 32000,
    transportCostMonth: 35000,
    overheadsAllocated: 60000,
    revenueMonth: 873600,
    downtimeHoursMonth: 14,
    nextMaintenanceInHours: 180,
    specs: {
      capacity: '50 т',
      boomLength: '38 м + гусёк 16 м',
      weight: '36 000 кг'
    },
    notes: 'Высокомаржинальная единица (маржа 52%). Работает по графику 6/1.'
  },
  {
    id: 'eq-3',
    branchId: 'branch-hq',
    inventoryNumber: 'CRN-05',
    name: 'Галичанин КС-55713-1 (25т)',
    type: 'crane',
    brand: 'Галичанин',
    plateNumber: 'B 552 OP 777',
    vin: 'XTC557131F0019284',
    year: 2022,
    owner: 'Собственный парк',
    purchasePrice: 11500000,
    currentValue: 9800000,
    status: 'rented',
    assignedSite: 'Складской комплекс «Внуково-Логистик»',
    assignedOperator: 'Михайлов И. Р.',
    currentHours: 3290,
    monthHours: 176,
    mileageKmMonth: 490,
    hourlyRate: 2900,
    fuelRateHour: 13.5,
    fuelCostMonth: 130000,
    driverSalaryMonth: 88000,
    repairCostMonth: 18000,
    transportCostMonth: 15000,
    overheadsAllocated: 35000,
    revenueMonth: 510400,
    downtimeHoursMonth: 8,
    nextMaintenanceInHours: 110,
    specs: {
      capacity: '25 т',
      boomLength: '21.7 м',
      weight: '21 800 кг'
    }
  },
  {
    id: 'eq-4',
    branchId: 'branch-hq',
    inventoryNumber: 'EXC-04',
    name: 'Caterpillar 320D2 GC',
    type: 'excavator',
    brand: 'Caterpillar',
    plateNumber: 'P 901 MH 199',
    vin: 'CAT0320DGK9018274',
    year: 2019,
    owner: 'Собственный парк',
    purchasePrice: 14200000,
    currentValue: 10500000,
    status: 'maintenance',
    assignedSite: 'Ремонтный бокс (База Дзержинский)',
    assignedOperator: 'Васильев О. С.',
    currentHours: 7890,
    monthHours: 92,
    mileageKmMonth: 0,
    hourlyRate: 3300,
    fuelRateHour: 18.2,
    fuelCostMonth: 92000,
    driverSalaryMonth: 50600,
    repairCostMonth: 145000,
    transportCostMonth: 30000,
    overheadsAllocated: 40000,
    revenueMonth: 303600,
    downtimeHoursMonth: 48,
    nextMaintenanceInHours: 10,
    specs: {
      capacity: '21.5 т',
      bucketVolume: '1.1 м³',
      weight: '21 500 кг'
    },
    notes: 'В плановом ТО-3: замена фильтров, гидравлических РВД и натяжителей гусениц. Выход на линию в понедельник.'
  },
  {
    id: 'eq-5',
    branchId: 'branch-hq',
    inventoryNumber: 'DMP-04',
    name: 'КАМАЗ 6520 (20 м³ / 30т)',
    type: 'dump_truck',
    brand: 'КАМАЗ',
    plateNumber: 'K 412 TX 799',
    vin: 'XTC652030K1849201',
    year: 2022,
    owner: 'ООО «СпецТехЛизинг»',
    purchasePrice: 9200000,
    currentValue: 8100000,
    status: 'rented',
    assignedSite: 'Песчаный карьер «Волоколамский»',
    assignedOperator: 'Григорьев С. М.',
    currentHours: 3840,
    monthHours: 198,
    mileageKmMonth: 4350,
    tripsMonth: 230,
    hourlyRate: 2400,
    fuelRateHour: 19.5,
    fuelCostMonth: 212000,
    driverSalaryMonth: 99000,
    repairCostMonth: 42000,
    transportCostMonth: 0,
    subcontractCostMonth: 45000,
    overheadsAllocated: 32000,
    revenueMonth: 475200,
    downtimeHoursMonth: 16,
    nextMaintenanceInHours: 160,
    specs: {
      capacity: '20 м³ / 30 т',
      weight: '14 500 кг'
    },
    notes: 'Выявлен скачок расхода ГСМ (+26.5% к норме). Направлен на калибровку датчика уровня топлива.'
  },
  {
    id: 'eq-6',
    branchId: 'branch-hq',
    inventoryNumber: 'DMP-08',
    name: 'Scania P380 CB (20 м³)',
    type: 'dump_truck',
    brand: 'Scania',
    plateNumber: 'C 289 OT 777',
    vin: 'YS2P6X40005829104',
    year: 2021,
    owner: 'Собственный парк',
    purchasePrice: 13900000,
    currentValue: 11800000,
    status: 'rented',
    assignedSite: 'Строительство дублёра Кутузовского',
    assignedOperator: 'Попов Д. В.',
    currentHours: 4620,
    monthHours: 210,
    mileageKmMonth: 4410,
    tripsMonth: 252,
    hourlyRate: 2600,
    fuelRateHour: 18.0,
    fuelCostMonth: 207000,
    driverSalaryMonth: 105000,
    repairCostMonth: 28000,
    transportCostMonth: 0,
    overheadsAllocated: 34000,
    revenueMonth: 546000,
    downtimeHoursMonth: 6,
    nextMaintenanceInHours: 240,
    specs: {
      capacity: '20 м³ / 32 т',
      weight: '15 200 кг'
    }
  },
  {
    id: 'eq-7',
    branchId: 'branch-hq',
    inventoryNumber: 'LDR-01',
    name: 'JCB 426ZX (Фронтальный)',
    type: 'loader',
    brand: 'JCB',
    plateNumber: 'T 114 EK 197',
    vin: 'JCB426ZX02194820',
    year: 2021,
    owner: 'Собственный парк',
    purchasePrice: 10800000,
    currentValue: 9100000,
    status: 'rented',
    assignedSite: 'Бетонный узел «ЕвроЦемент»',
    assignedOperator: 'Никитин Р. А.',
    currentHours: 3950,
    monthHours: 190,
    mileageKmMonth: 215,
    hourlyRate: 2700,
    fuelRateHour: 14.0,
    fuelCostMonth: 146000,
    driverSalaryMonth: 95000,
    repairCostMonth: 22000,
    transportCostMonth: 18000,
    overheadsAllocated: 32000,
    revenueMonth: 513000,
    downtimeHoursMonth: 10,
    nextMaintenanceInHours: 150,
    specs: {
      bucketVolume: '2.1 м³',
      capacity: '14.5 т',
      weight: '14 500 кг'
    }
  },
  {
    id: 'eq-8',
    branchId: 'branch-hq',
    inventoryNumber: 'BLD-02',
    name: 'Shantui SD16 (Бульдозер)',
    type: 'bulldozer',
    brand: 'Shantui',
    plateNumber: 'A 604 KH 777',
    vin: 'SHTSD1600184920',
    year: 2022,
    owner: 'Собственный парк',
    purchasePrice: 12200000,
    currentValue: 10600000,
    status: 'rented',
    assignedSite: 'Полигон ТКО «Малинки»',
    assignedOperator: 'Семёнов П. И.',
    currentHours: 3100,
    monthHours: 184,
    mileageKmMonth: 0,
    hourlyRate: 3100,
    fuelRateHour: 19.0,
    fuelCostMonth: 192000,
    driverSalaryMonth: 92000,
    repairCostMonth: 34000,
    transportCostMonth: 30000,
    subcontractCostMonth: 28000,
    overheadsAllocated: 38000,
    revenueMonth: 570400,
    downtimeHoursMonth: 12,
    nextMaintenanceInHours: 90,
    specs: {
      capacity: '17.5 т',
      bucketVolume: 'Отвал прямой 4.5 м³',
      weight: '17 500 кг'
    }
  },
  {
    id: 'eq-9',
    branchId: 'branch-hq',
    inventoryNumber: 'CRN-09',
    name: 'Ивановец КС-45717-1Р (25т)',
    type: 'crane',
    brand: 'Ивановец',
    plateNumber: 'H 337 BA 777',
    vin: 'XTC457171E0028471',
    year: 2020,
    owner: 'Собственный парк',
    purchasePrice: 9800000,
    currentValue: 7900000,
    status: 'available',
    assignedSite: 'Центральная база «Южная»',
    currentHours: 4980,
    monthHours: 64,
    mileageKmMonth: 185,
    hourlyRate: 2800,
    fuelRateHour: 13.0,
    fuelCostMonth: 45000,
    driverSalaryMonth: 32000,
    repairCostMonth: 15000,
    transportCostMonth: 0,
    overheadsAllocated: 25000,
    revenueMonth: 179200,
    downtimeHoursMonth: 52,
    nextMaintenanceInHours: 210,
    specs: {
      capacity: '25 т',
      boomLength: '30.7 м',
      weight: '23 400 кг'
    },
    notes: 'Свободен к аренде. Находится на консервации между сменами. Готов к немедленной подаче на объект.'
  },
  {
    id: 'eq-10',
    branchId: 'branch-hq',
    inventoryNumber: 'CHP-01',
    name: 'Tadano AT-220 (Автовышка 22м)',
    type: 'cherry_picker',
    brand: 'Tadano',
    plateNumber: 'O 812 PK 777',
    vin: 'TDNAT22099182741',
    year: 2021,
    owner: 'Собственный парк',
    purchasePrice: 8400000,
    currentValue: 7200000,
    status: 'rented',
    assignedSite: 'Монтаж фасадов ТРЦ «Саларис»',
    assignedOperator: 'Крылов Е. В.',
    currentHours: 2890,
    monthHours: 168,
    mileageKmMonth: 440,
    hourlyRate: 2500,
    fuelRateHour: 11.0,
    fuelCostMonth: 101000,
    driverSalaryMonth: 84000,
    repairCostMonth: 12000,
    transportCostMonth: 0,
    overheadsAllocated: 28000,
    revenueMonth: 420000,
    downtimeHoursMonth: 8,
    nextMaintenanceInHours: 190,
    specs: {
      capacity: '250 кг люлька',
      boomLength: '22 м',
      weight: '8 500 кг'
    }
  },
  {
    id: 'eq-11',
    branchId: 'branch-hq',
    inventoryNumber: 'EXC-19',
    name: 'Hyundai R220LC-9S',
    type: 'excavator',
    brand: 'Hyundai',
    plateNumber: 'X 602 PP 777',
    vin: 'HYR220LC90192834',
    year: 2022,
    owner: 'ООО «СпецТехЛизинг»',
    purchasePrice: 14900000,
    currentValue: 12900000,
    status: 'reserve',
    assignedSite: 'Центральная база «Южная»',
    currentHours: 2420,
    monthHours: 36,
    mileageKmMonth: 0,
    hourlyRate: 3300,
    fuelRateHour: 17.0,
    fuelCostMonth: 33000,
    driverSalaryMonth: 18000,
    repairCostMonth: 8000,
    transportCostMonth: 0,
    overheadsAllocated: 22000,
    revenueMonth: 118800,
    downtimeHoursMonth: 68,
    nextMaintenanceInHours: 260,
    specs: {
      capacity: '21.9 т',
      bucketVolume: '1.1 м³',
      weight: '21 900 кг'
    },
    notes: 'Резервная машина под контракт с МосАвтодором. Планируемый старт с 15 числа.'
  },
  {
    id: 'eq-12',
    branchId: 'branch-hq',
    inventoryNumber: 'DMP-12',
    name: 'Shacman X3000 (8x4 / 26 м³)',
    type: 'dump_truck',
    brand: 'Shacman',
    plateNumber: 'P 115 CT 799',
    vin: 'SX4255NV32488190',
    year: 2023,
    owner: 'Собственный парк',
    purchasePrice: 11200000,
    currentValue: 10400000,
    status: 'rented',
    assignedSite: 'Строительство дублёра МКАД',
    assignedOperator: 'Федотов Н. А.',
    currentHours: 1950,
    monthHours: 215,
    mileageKmMonth: 4950,
    tripsMonth: 268,
    hourlyRate: 2600,
    fuelRateHour: 20.0,
    fuelCostMonth: 236000,
    driverSalaryMonth: 107500,
    repairCostMonth: 19000,
    transportCostMonth: 0,
    subcontractCostMonth: 36000,
    overheadsAllocated: 34000,
    revenueMonth: 559000,
    downtimeHoursMonth: 10,
    nextMaintenanceInHours: 140,
    specs: {
      capacity: '26 м³ / 35 т',
      weight: '16 800 кг'
    }
  },
  // Филиал «Поволжье» (Казань)
  {
    id: 'eq-kzn-1',
    branchId: 'branch-kzn',
    inventoryNumber: 'KZN-EXC-01',
    name: 'Volvo EC220DL (Гусеничный)',
    type: 'excavator',
    brand: 'Volvo',
    plateNumber: '16 TA 4012',
    vin: 'VCEC220DL00219401',
    year: 2022,
    owner: 'Собственный парк (Филиал Казань)',
    purchasePrice: 16200000,
    currentValue: 13800000,
    status: 'rented',
    assignedSite: 'Трасса М-12 (обход Казани, км 74)',
    assignedOperator: 'Сафиуллин Р. Ф.',
    currentHours: 3680,
    monthHours: 186,
    mileageKmMonth: 0,
    hourlyRate: 3200,
    fuelRateHour: 16.5,
    fuelCostMonth: 199400,
    driverSalaryMonth: 102300,
    repairCostMonth: 24000,
    transportCostMonth: 22000,
    subcontractCostMonth: 34000,
    overheadsAllocated: 36000,
    revenueMonth: 595200,
    downtimeHoursMonth: 8,
    nextMaintenanceInHours: 130,
    specs: {
      capacity: '22.5 т',
      bucketVolume: '1.2 м³',
      weight: '22 500 кг'
    },
    notes: 'Закреплён за долгосрочным объектом ООО «ТатСтройМост».'
  },
  {
    id: 'eq-kzn-2',
    branchId: 'branch-kzn',
    inventoryNumber: 'KZN-CRN-01',
    name: 'XCMG QY30K5-I (Автокран 30т)',
    type: 'crane',
    brand: 'XCMG',
    plateNumber: 'K 821 BT 116',
    vin: 'LXGCPA301N0018412',
    year: 2023,
    owner: 'Собственный парк (Филиал Казань)',
    purchasePrice: 14800000,
    currentValue: 13100000,
    status: 'rented',
    assignedSite: 'Промпарк «Химград» (Казань)',
    assignedOperator: 'Галеев Д. Ш.',
    currentHours: 2410,
    monthHours: 172,
    mileageKmMonth: 580,
    hourlyRate: 3300,
    fuelRateHour: 14.0,
    fuelCostMonth: 156500,
    driverSalaryMonth: 94600,
    repairCostMonth: 16000,
    transportCostMonth: 0,
    overheadsAllocated: 32000,
    revenueMonth: 567600,
    downtimeHoursMonth: 6,
    nextMaintenanceInHours: 38,
    specs: {
      capacity: '30 т',
      boomLength: '40.5 м + гусёк 8.3 м',
      weight: '32 600 кг'
    },
    notes: 'Приближение планового ТО-2 (осталось 38 м/ч).'
  },
  {
    id: 'eq-kzn-3',
    branchId: 'branch-kzn',
    inventoryNumber: 'KZN-DMP-01',
    name: 'КАМАЗ 6520-6012 Люкс (20 м³)',
    type: 'dump_truck',
    brand: 'КАМАЗ',
    plateNumber: 'E 509 PK 716',
    vin: 'XTC652060N1920411',
    year: 2023,
    owner: 'ООО «СпецТехЛизинг»',
    purchasePrice: 9800000,
    currentValue: 8900000,
    status: 'rented',
    assignedSite: 'Карьер «Сокуры» → ИТ-парк Иннополис',
    assignedOperator: 'Мухаметшин А. Н.',
    currentHours: 2920,
    monthHours: 204,
    mileageKmMonth: 4896,
    tripsMonth: 204,
    hourlyRate: 2300,
    fuelRateHour: 19.0,
    fuelCostMonth: 282000,
    driverSalaryMonth: 102000,
    repairCostMonth: 21000,
    transportCostMonth: 0,
    subcontractCostMonth: 29000,
    overheadsAllocated: 29000,
    revenueMonth: 469200,
    downtimeHoursMonth: 12,
    nextMaintenanceInHours: 185,
    specs: {
      capacity: '20 м³ / 28 т',
      weight: '14 400 кг'
    },
    notes: 'Зафиксирован повышенный расход ГСМ на плече 24 км — выставлен Alert к отчёту в конце месяца.'
  },
  {
    id: 'eq-kzn-4',
    branchId: 'branch-kzn',
    inventoryNumber: 'KZN-LDR-01',
    name: 'SDLG LG956L (Фронтальный 3 м³)',
    type: 'loader',
    brand: 'SDLG',
    plateNumber: '16 TC 8840',
    vin: 'SDLG956L00491822',
    year: 2022,
    owner: 'Собственный парк (Филиал Казань)',
    purchasePrice: 8900000,
    currentValue: 7400000,
    status: 'available',
    assignedSite: 'База Филиала «Поволжье» (ул. Техническая, 52)',
    assignedOperator: 'Закиров Т. М.',
    currentHours: 3140,
    monthHours: 112,
    mileageKmMonth: 190,
    hourlyRate: 2600,
    fuelRateHour: 14.5,
    fuelCostMonth: 105500,
    driverSalaryMonth: 56000,
    repairCostMonth: 14000,
    transportCostMonth: 12000,
    overheadsAllocated: 24000,
    revenueMonth: 291200,
    downtimeHoursMonth: 20,
    nextMaintenanceInHours: 195,
    specs: {
      capacity: '5 т / ковш 3.0 м³',
      bucketVolume: '3.0 м³',
      weight: '17 100 кг'
    },
    notes: 'Свободен, готов к подаче постоянным заказчикам в Казани и Иннополисе.'
  },
  {
    id: 'eq-kzn-5',
    branchId: 'branch-kzn',
    inventoryNumber: 'KZN-BLD-01',
    name: 'ЧТЗ Б10М.0111-1Е (Бульдозер)',
    type: 'bulldozer',
    brand: 'ЧТЗ',
    plateNumber: '16 TE 3091',
    vin: 'CHTZB10M99104218',
    year: 2021,
    owner: 'Собственный парк (Филиал Казань)',
    purchasePrice: 10400000,
    currentValue: 8200000,
    status: 'rented',
    assignedSite: 'Индустриальный парк «М-7 Лаишево»',
    assignedOperator: 'Хасанов Р. И.',
    currentHours: 4250,
    monthHours: 178,
    mileageKmMonth: 0,
    hourlyRate: 2900,
    fuelRateHour: 18.5,
    fuelCostMonth: 214000,
    driverSalaryMonth: 89000,
    repairCostMonth: 28000,
    transportCostMonth: 24000,
    overheadsAllocated: 31000,
    revenueMonth: 516200,
    downtimeHoursMonth: 10,
    nextMaintenanceInHours: 120,
    specs: {
      capacity: '19.5 т',
      bucketVolume: 'Отвал полусферический 4.75 м³',
      weight: '19 500 кг'
    }
  }
];

export const initialCRMDeals: CRMDeal[] = [
  {
    id: 'deal-1',
    branchId: 'branch-hq',
    clientName: 'ООО «Монолит-Строй»',
    contactPerson: 'Захаров Роман Олегович',
    phone: '+7 (495) 781-44-12',
    equipmentType: 'excavator',
    equipmentAssignedId: 'eq-1',
    hoursRequested: 240,
    hourlyRateAgreed: 3400,
    estimatedAmount: 816000,
    stage: 'active',
    debtAmount: 240000,
    siteAddress: 'Москва, Дмитровское шоссе, вл. 82',
    dateCreated: '2026-10-14',
    manager: 'Елисеев Д. М.'
  },
  {
    id: 'deal-2',
    branchId: 'branch-hq',
    clientName: 'АО «Автодор-Инвест»',
    contactPerson: 'Степанов Илья Борисович',
    phone: '+7 (495) 912-30-00',
    equipmentType: 'crane',
    equipmentAssignedId: 'eq-2',
    hoursRequested: 300,
    hourlyRateAgreed: 4800,
    estimatedAmount: 1440000,
    stage: 'active',
    debtAmount: 0,
    siteAddress: 'Калужская область, мостовой переход р. Десна',
    dateCreated: '2026-10-18',
    manager: 'Орлов П. С.'
  },
  {
    id: 'deal-3',
    branchId: 'branch-hq',
    clientName: 'ООО «ГрандСтройИнвест»',
    contactPerson: 'Карпов Геннадий Сергеевич',
    phone: '+7 (916) 334-11-88',
    equipmentType: 'crane',
    equipmentAssignedId: 'eq-3',
    hoursRequested: 160,
    hourlyRateAgreed: 2900,
    estimatedAmount: 464000,
    stage: 'active',
    debtAmount: 580000,
    siteAddress: 'Москва, пос. Московский, ТРЦ «Плаза»',
    dateCreated: '2026-10-22',
    manager: 'Елисеев Д. М.'
  },
  {
    id: 'deal-4',
    branchId: 'branch-hq',
    clientName: 'ООО «ДорСтройХолдинг»',
    contactPerson: 'Воронов Андрей Викторович',
    phone: '+7 (926) 450-20-10',
    equipmentType: 'dump_truck',
    hoursRequested: 350,
    hourlyRateAgreed: 2500,
    estimatedAmount: 875000,
    stage: 'contract',
    debtAmount: 0,
    siteAddress: 'М-12 «Восток», 44-й км',
    dateCreated: '2026-10-28',
    manager: 'Орлов П. С.'
  },
  {
    id: 'deal-5',
    branchId: 'branch-hq',
    clientName: 'ГК «Пионер Развитие»',
    contactPerson: 'Беляева Марина Игоревна',
    phone: '+7 (495) 604-89-11',
    equipmentType: 'loader',
    hoursRequested: 120,
    hourlyRateAgreed: 2700,
    estimatedAmount: 324000,
    stage: 'calculation',
    debtAmount: 0,
    siteAddress: 'Москва, ул. Полярная, д. 25',
    dateCreated: '2026-11-01',
    manager: 'Елисеев Д. М.'
  },
  {
    id: 'deal-6',
    branchId: 'branch-hq',
    clientName: 'ООО «ТрансСтройСеть»',
    contactPerson: 'Алексеев Денис Константинович',
    phone: '+7 (903) 712-40-55',
    equipmentType: 'excavator',
    hoursRequested: 200,
    hourlyRateAgreed: 3300,
    estimatedAmount: 660000,
    stage: 'lead',
    debtAmount: 0,
    siteAddress: 'МО, г. Химки, промзона Северная',
    dateCreated: '2026-11-02',
    manager: 'Орлов П. С.'
  },
  {
    id: 'deal-7',
    branchId: 'branch-hq',
    clientName: 'ООО «ИнфраИнжиниринг»',
    contactPerson: 'Марков Юрий Павлович',
    phone: '+7 (495) 332-90-88',
    equipmentType: 'crane',
    hoursRequested: 80,
    hourlyRateAgreed: 4800,
    estimatedAmount: 384000,
    stage: 'lead',
    debtAmount: 0,
    siteAddress: 'Москва, Котельники, логистический парк',
    dateCreated: '2026-11-03',
    manager: 'Елисеев Д. М.'
  },
  // CRM-сделки Филиала «Поволжье» (Казань)
  {
    id: 'deal-kzn-1',
    branchId: 'branch-kzn',
    clientName: 'ООО «ТатСтройМост»',
    contactPerson: 'Халиуллин Марат Рашидович',
    phone: '+7 (843) 518-22-40',
    clientType: 'legal_entity',
    hasContract: true,
    accountingSubject: 'ooo_specialtech',
    equipmentType: 'excavator',
    equipmentAssignedId: 'eq-kzn-1',
    hoursRequested: 200,
    hourlyRateAgreed: 3200,
    estimatedAmount: 640000,
    stage: 'active',
    debtAmount: 0,
    siteAddress: 'г. Казань, трасса М-12, км 74',
    dateCreated: '2026-10-16',
    manager: 'Волков И. А.'
  },
  {
    id: 'deal-kzn-2',
    branchId: 'branch-kzn',
    clientName: 'АО «КазаньПромИнвест»',
    contactPerson: 'Нуриев Рустем Фаритович',
    phone: '+7 (843) 224-11-90',
    clientType: 'legal_entity',
    hasContract: true,
    accountingSubject: 'ooo_specialtech',
    equipmentType: 'crane',
    equipmentAssignedId: 'eq-kzn-2',
    hoursRequested: 180,
    hourlyRateAgreed: 3300,
    estimatedAmount: 594000,
    stage: 'active',
    debtAmount: 195000,
    siteAddress: 'г. Казань, Технополис «Химград», корп. 7',
    dateCreated: '2026-10-20',
    manager: 'Волков И. А.'
  },
  {
    id: 'deal-kzn-3',
    branchId: 'branch-kzn',
    clientName: 'ООО «ВолгаДорСервис»',
    contactPerson: 'Егоров Сергей Анатольевич',
    phone: '+7 (917) 881-44-09',
    clientType: 'legal_entity',
    hasContract: true,
    accountingSubject: 'ooo_specialtech',
    equipmentType: 'loader',
    hoursRequested: 140,
    hourlyRateAgreed: 2600,
    estimatedAmount: 364000,
    stage: 'contract',
    debtAmount: 0,
    siteAddress: 'РТ, г. Иннополис, ул. Университетская, 12',
    dateCreated: '2026-11-01',
    manager: 'Волков И. А.'
  },
  {
    id: 'deal-kzn-4',
    branchId: 'branch-kzn',
    clientName: 'Ахметов И. Р. (Частный заказ)',
    contactPerson: 'Ахметов Ильдар',
    phone: '+7 (987) 210-77-31',
    clientType: 'individual',
    hasContract: false,
    accountingSubject: 'ip_specialtechnica',
    equipmentType: 'loader',
    hoursRequested: 24,
    hourlyRateAgreed: 2600,
    estimatedAmount: 62400,
    stage: 'lead',
    debtAmount: 0,
    siteAddress: 'Казань, пос. Салмачи, ул. Центральная, уч. 18',
    dateCreated: '2026-11-03',
    manager: 'Волков И. А.'
  }
];

export const initialRentalOrders: RentalOrder[] = [
  {
    id: 'ord-101',
    branchId: 'branch-hq',
    orderNumber: 'RO-MSK-2026-101',
    clientName: 'ООО «Монолит-Строй»',
    equipmentId: 'eq-1',
    operatorName: 'Соколов В. П.',
    siteAddress: 'Москва, Дмитровское ш., 82',
    startDate: '2026-10-05',
    endDate: '2026-11-15',
    plannedHours: 240,
    actualHours: 194,
    hourlyRate: 3400,
    status: 'active',
    actSigned: false,
    paidAmount: 419600,
    totalAmount: 659600
  },
  {
    id: 'ord-102',
    branchId: 'branch-hq',
    orderNumber: 'RO-MSK-2026-102',
    clientName: 'АО «Автодор-Инвест»',
    equipmentId: 'eq-2',
    operatorName: 'Кузнецов А. М.',
    siteAddress: 'Калужская область, мостовой переход',
    startDate: '2026-10-01',
    endDate: '2026-11-30',
    plannedHours: 220,
    actualHours: 182,
    hourlyRate: 4800,
    status: 'active',
    actSigned: true,
    paidAmount: 873600,
    totalAmount: 873600
  },
  {
    id: 'ord-103',
    branchId: 'branch-hq',
    orderNumber: 'RO-MSK-2026-103',
    clientName: 'ООО «ГрандСтройИнвест»',
    equipmentId: 'eq-3',
    operatorName: 'Михайлов И. Р.',
    siteAddress: 'Москва, пос. Московский, ТРЦ «Плаза»',
    startDate: '2026-10-10',
    endDate: '2026-11-10',
    plannedHours: 180,
    actualHours: 176,
    hourlyRate: 2900,
    status: 'active',
    actSigned: false,
    paidAmount: 0,
    totalAmount: 510400
  },
  {
    id: 'ord-104',
    branchId: 'branch-hq',
    orderNumber: 'RO-MSK-2026-104',
    clientName: 'ООО «НерудТранс»',
    equipmentId: 'eq-5',
    operatorName: 'Григорьев С. М.',
    siteAddress: 'Карьер «Волоколамский»',
    startDate: '2026-10-04',
    endDate: '2026-11-20',
    plannedHours: 200,
    actualHours: 198,
    hourlyRate: 2400,
    status: 'active',
    actSigned: true,
    paidAmount: 350000,
    totalAmount: 475200
  },
  // Договоры / Заказы Филиала «Поволжье» (Казань)
  {
    id: 'ord-kzn-201',
    branchId: 'branch-kzn',
    orderNumber: 'RO-KZN-2026-201',
    clientName: 'ООО «ТатСтройМост»',
    clientType: 'legal_entity',
    hasContract: true,
    accountingSubject: 'ooo_specialtech',
    equipmentId: 'eq-kzn-1',
    operatorName: 'Сафиуллин Р. Ф.',
    siteAddress: 'г. Казань, трасса М-12, км 74',
    startDate: '2026-10-08',
    endDate: '2026-11-25',
    plannedHours: 200,
    actualHours: 186,
    hourlyRate: 3200,
    status: 'active',
    actSigned: true,
    paidAmount: 595200,
    totalAmount: 595200
  },
  {
    id: 'ord-kzn-202',
    branchId: 'branch-kzn',
    orderNumber: 'RO-KZN-2026-202',
    clientName: 'АО «КазаньПромИнвест»',
    clientType: 'legal_entity',
    hasContract: true,
    accountingSubject: 'ooo_specialtech',
    equipmentId: 'eq-kzn-2',
    operatorName: 'Галеев Д. Ш.',
    siteAddress: 'г. Казань, Промпарк «Химград»',
    startDate: '2026-10-12',
    endDate: '2026-11-30',
    plannedHours: 180,
    actualHours: 172,
    hourlyRate: 3300,
    status: 'active',
    actSigned: false,
    paidAmount: 372600,
    totalAmount: 567600
  },
  {
    id: 'ord-kzn-203',
    branchId: 'branch-kzn',
    orderNumber: 'RO-KZN-2026-203',
    clientName: 'ООО «Иннополис-Строй»',
    clientType: 'legal_entity',
    hasContract: true,
    accountingSubject: 'ooo_specialtech',
    equipmentId: 'eq-kzn-5',
    operatorName: 'Хасанов Р. И.',
    siteAddress: 'РТ, Индустриальный парк «М-7 Лаишево»',
    startDate: '2026-10-15',
    endDate: '2026-11-28',
    plannedHours: 190,
    actualHours: 178,
    hourlyRate: 2900,
    status: 'active',
    actSigned: true,
    paidAmount: 516200,
    totalAmount: 516200
  }
];

export const initialShiftReports: ShiftReport[] = [
  {
    id: 'sh-409',
    branchId: 'branch-hq',
    shiftNumber: 'SH-MSK-409',
    date: '2026-11-02',
    equipmentId: 'eq-1',
    driverId: 'drv-1',
    operatorName: 'Соколов В. П.',
    driverPhone: '+7 (916) 510-22-01',
    cardLast4: '4819',
    clientName: 'ООО «Монолит-Строй»',
    orderId: 'ord-1',
    dealId: 'deal-1',
    siteName: 'ЖК «Северный квартал»',
    startHours: 5406,
    endHours: 5420,
    workHours: 14,
    downtimeHours: 0,
    mileageKm: 0,
    fuelLitersAdded: 280,
    fuelHourlyCalculated: 20.0,
    paymentCategory: 'fuel_own_tank',
    paymentAmountRub: 18200,
    subcontractCostRub: 4200,
    photoVerified: true,
    status: 'anomaly',
    anomalyMessage: 'Подозрительная длительность смены: 14 ч при согласованной 10-часовой смене объекта. Расхождение с датчиком вибрации двигателя.',
    calculatedSalary: 7700
  },
  {
    id: 'sh-410',
    branchId: 'branch-hq',
    shiftNumber: 'SH-MSK-410',
    date: '2026-11-02',
    equipmentId: 'eq-2',
    operatorName: 'Кузнецов А. М.',
    siteName: 'Мостовой переход р. Десна',
    startHours: 4110,
    endHours: 4120,
    workHours: 10,
    downtimeHours: 1.5,
    mileageKm: 34,
    downtimeReason: 'Ожидание подачи железобетонных балок тралом',
    fuelLitersAdded: 160,
    fuelHourlyCalculated: 16.0,
    photoVerified: true,
    status: 'approved',
    calculatedSalary: 7000
  },
  {
    id: 'sh-411',
    branchId: 'branch-hq',
    shiftNumber: 'SH-MSK-411',
    date: '2026-11-02',
    equipmentId: 'eq-3',
    operatorName: 'Михайлов И. Р.',
    siteName: 'Складской комплекс «Внуково»',
    startHours: 3280,
    endHours: 3290,
    workHours: 10,
    downtimeHours: 0,
    mileageKm: 28,
    fuelLitersAdded: 135,
    fuelHourlyCalculated: 13.5,
    photoVerified: true,
    status: 'approved',
    calculatedSalary: 5000
  },
  {
    id: 'sh-412',
    branchId: 'branch-hq',
    shiftNumber: 'SH-MSK-412',
    date: '2026-11-02',
    equipmentId: 'eq-5',
    operatorName: 'Григорьев С. М.',
    siteName: 'Песчаный карьер «Волоколамский»',
    startHours: 3828,
    endHours: 3840,
    workHours: 12,
    downtimeHours: 3,
    mileageKm: 264,
    tripsCount: 14,
    downtimeReason: 'Очередь под погрузку на экскаваторе карьера',
    fuelLitersAdded: 310,
    fuelHourlyCalculated: 25.8,
    subcontractCostRub: 5500,
    photoVerified: false,
    status: 'anomaly',
    anomalyMessage: 'Превышение нормы расхода топлива на 32% (25.8 л/ч против нормы 19.5 л/ч). Нет фото талона АЗС.',
    calculatedSalary: 6000
  },
  {
    id: 'sh-413',
    branchId: 'branch-hq',
    shiftNumber: 'SH-MSK-413',
    date: '2026-11-01',
    equipmentId: 'eq-6',
    operatorName: 'Попов Д. В.',
    siteName: 'Дублёр Кутузовского',
    startHours: 4610,
    endHours: 4620,
    workHours: 10,
    downtimeHours: 0,
    mileageKm: 210,
    tripsCount: 12,
    fuelLitersAdded: 180,
    fuelHourlyCalculated: 18.0,
    photoVerified: true,
    status: 'approved',
    calculatedSalary: 5000
  },
  {
    id: 'sh-414',
    branchId: 'branch-hq',
    shiftNumber: 'SH-MSK-414',
    date: '2026-11-01',
    equipmentId: 'eq-7',
    operatorName: 'Никитин Р. А.',
    siteName: 'Бетонный узел «ЕвроЦемент»',
    startHours: 3940,
    endHours: 3950,
    workHours: 10,
    downtimeHours: 0.5,
    mileageKm: 12,
    fuelLitersAdded: 140,
    fuelHourlyCalculated: 14.0,
    photoVerified: true,
    status: 'approved',
    calculatedSalary: 5000
  },
  // Сменные рапорты Филиала «Поволжье» (Казань)
  {
    id: 'sh-kzn-101',
    branchId: 'branch-kzn',
    shiftNumber: 'SH-KZN-101',
    date: '2026-11-02',
    equipmentId: 'eq-kzn-1',
    driverId: 'drv-kzn-1',
    operatorName: 'Сафиуллин Р. Ф.',
    driverPhone: '+7 (917) 250-44-01',
    cardLast4: '4401',
    clientName: 'ООО «ТатСтройМост»',
    orderId: 'ord-kzn-201',
    dealId: 'deal-kzn-1',
    siteName: 'Трасса М-12 (обход Казани)',
    workStartTime: '08:00',
    workEndTime: '18:00',
    relocationHours: 0,
    startHours: 3670,
    endHours: 3680,
    workHours: 10,
    downtimeHours: 0,
    mileageKm: 0,
    fuelLitersAdded: 165,
    fuelHourlyCalculated: 16.5,
    paymentCategory: 'fuel_own_tank',
    paymentAmountRub: 10725,
    subcontractCostRub: 3800,
    waybillGenerated: true,
    waybillNumber: 'ПЛ-КЗН-261102-101',
    photoVerified: true,
    status: 'approved',
    calculatedSalary: 5500
  },
  {
    id: 'sh-kzn-102',
    branchId: 'branch-kzn',
    shiftNumber: 'SH-KZN-102',
    date: '2026-11-02',
    equipmentId: 'eq-kzn-3',
    operatorName: 'Мухаметшин А. Н.',
    siteName: 'Карьер «Сокуры» → Иннополис',
    workStartTime: '07:30',
    workEndTime: '19:30',
    relocationHours: 1,
    startHours: 2908,
    endHours: 2920,
    workHours: 12,
    downtimeHours: 0,
    mileageKm: 288,
    tripsCount: 12,
    fuelLitersAdded: 294,
    fuelHourlyCalculated: 24.5,
    paymentCategory: 'fuel_own_tank',
    paymentAmountRub: 19110,
    subcontractCostRub: 4800,
    waybillGenerated: true,
    waybillNumber: 'ПЛ-КЗН-261102-102',
    photoVerified: true,
    status: 'anomaly',
    anomalyMessage: 'Превышение расхода ГСМ на +28.9% (24.5 л/ч при норме 19.0 л/ч). Зафиксирован Alert в логах, водитель уведомлён к отчёту до конца месяца.',
    calculatedSalary: 6500
  },
  {
    id: 'sh-kzn-103',
    branchId: 'branch-kzn',
    shiftNumber: 'SH-KZN-103',
    date: '2026-11-01',
    equipmentId: 'eq-kzn-2',
    operatorName: 'Галеев Д. Ш.',
    siteName: 'Промпарк «Химград»',
    workStartTime: '08:00',
    workEndTime: '18:00',
    relocationHours: 0,
    startHours: 2400,
    endHours: 2410,
    workHours: 10,
    downtimeHours: 0.5,
    mileageKm: 42,
    fuelLitersAdded: 140,
    fuelHourlyCalculated: 14.0,
    paymentCategory: 'fuel_own_tank',
    paymentAmountRub: 9100,
    waybillGenerated: true,
    waybillNumber: 'ПЛ-КЗН-261101-103',
    photoVerified: true,
    status: 'approved',
    calculatedSalary: 7000
  }
];

export const initialAnomalies: AnomalyAlert[] = [
  {
    id: 'ano-1',
    branchId: 'branch-hq',
    severity: 'critical',
    category: 'shift',
    title: 'Расхождение моточасов и длительности смены',
    description: 'Машинист Соколов В. П. (Komatsu PC210, инв. EXC-14) указал 14 часов работы за смену 02.11, однако прораб подтверждает работу только до 19:00 (10 часов). Риск переплаты з/п и претензий заказчика.',
    equipmentId: 'eq-1',
    equipmentName: 'Komatsu PC210 (EXC-14)',
    date: '2026-11-02',
    impactRubles: 13600,
    resolved: false
  },
  {
    id: 'ano-2',
    branchId: 'branch-hq',
    severity: 'critical',
    category: 'fuel',
    title: 'Аномальный всплеск расхода ГСМ (+32%)',
    description: 'Самосвал КАМАЗ 6520 (инв. DMP-04, водитель Григорьев С. М.): расход 25.8 л/час при утвержденном нормативе 19.5 л/час. Вероятен слив топлива либо неисправность ТНВД.',
    equipmentId: 'eq-5',
    equipmentName: 'КАМАЗ 6520 (DMP-04)',
    date: '2026-11-02',
    impactRubles: 18500,
    resolved: false
  },
  {
    id: 'ano-3',
    branchId: 'branch-hq',
    severity: 'warning',
    category: 'finance',
    title: 'Критическая дебиторская задолженность > 20 дней',
    description: 'ООО «ГрандСтройИнвест» задолжало 580 000 ₽ по актам за автокран КС-55713 (CRN-05). При этом автокран продолжает работать на их объекте ТРЦ «Плаза». Рекомендуется приостановка смен.',
    equipmentId: 'eq-3',
    equipmentName: 'Галичанин КС-55713 (CRN-05)',
    date: '2026-11-01',
    impactRubles: 580000,
    resolved: false
  },
  {
    id: 'ano-4',
    branchId: 'branch-hq',
    severity: 'warning',
    category: 'maintenance',
    title: 'Приближение критического ТО-3 (осталось 10 моточасов)',
    description: 'Гусеничный экскаватор Cat 320D (инв. EXC-04) выработал 240 моточасов. Превышение межсервисного интервала влечет снятие с гарантии на двигатель C7.1.',
    equipmentId: 'eq-4',
    equipmentName: 'Caterpillar 320D (EXC-04)',
    date: '2026-11-01',
    impactRubles: 95000,
    resolved: false
  },
  {
    id: 'ano-5',
    branchId: 'branch-hq',
    severity: 'info',
    category: 'downtime',
    title: 'Скрытый простой без актирования заказчику',
    description: 'Автокран Liebherr LTM 1050 (CRN-02) простоял 14 часов из-за задержки поставки конструкций заказчиком. Акт технологического простоя не подписан у прораба.',
    equipmentId: 'eq-2',
    equipmentName: 'Liebherr LTM 1050 (CRN-02)',
    date: '2026-10-31',
    impactRubles: 67200,
    resolved: false
  },
  // Инциденты Филиала «Поволжье» (Казань)
  {
    id: 'ano-kzn-1',
    branchId: 'branch-kzn',
    severity: 'critical',
    category: 'fuel',
    title: 'Alert ГСМ +28.9% на КАМАЗ 6520 (Казань)',
    description: 'Самосвал КАМАЗ 6520 (инв. KZN-DMP-01, водитель Мухаметшин А. Н.): расход 24.5 л/ч при норме 19.0 л/ч. Зафиксирован день в логах, водитель уведомлён к отчёту до конца месяца.',
    equipmentId: 'eq-kzn-3',
    equipmentName: 'КАМАЗ 6520 (KZN-DMP-01)',
    date: '2026-11-02',
    impactRubles: 14200,
    resolved: false
  },
  {
    id: 'ano-kzn-2',
    branchId: 'branch-kzn',
    severity: 'warning',
    category: 'maintenance',
    title: 'Приближение ТО-2 автокрана XCMG 30т (осталось 38 м/ч)',
    description: 'Автокран XCMG QY30K5-I (инв. KZN-CRN-01) на объекте Промпарк «Химград» приближается к регламентному ТО-2. Необходимо запланировать сервис на базе в Казани.',
    equipmentId: 'eq-kzn-2',
    equipmentName: 'XCMG QY30K5-I (KZN-CRN-01)',
    date: '2026-11-02',
    impactRubles: 45000,
    resolved: false
  }
];

export const initialKnowledgeDocs: KnowledgeDoc[] = [
  {
    id: 'doc-1',
    title: 'Регламент сдачи спецтехники в аренду и подписания актов (ЭДО / КС-2)',
    category: 'regulations',
    code: 'REG-OPS-01/2026',
    dateUpdated: '2026-09-15',
    excerpt: 'Порядок передачи техники, ежедневного визирования путевых листов прорабом заказчика и выставления счетов.',
    tags: ['аренда', 'акты', 'КС-2', 'регламент'],
    fullText: `1. ОБЩИЕ ПОЛОЖЕНИЯ
1.1. Техника передается заказчику на основании Договора аренды строительной техники с экипажем и Акта приема-передачи (Форма ОС-1).
1.2. Минимальная продолжительность оплачиваемой смены составляет 8 машино-часов (7 часов работы + 1 час подачи техники в черте города).
1.3. При перебазировке за МКАД доставка тяжелой техники (экскаваторы, бульдозеры) тралом оплачивается заказчиком в оба конца в полном объеме до выезда с базы.

2. ПОРЯДОК УЧЕТА РАБОЧЕГО ВРЕМЕНИ
2.1. Машинист обязан ежедневно в конце смены предъявить электронный или бумажный сменный рапорт (форма ЭСМ-7) уполномоченному представителю Заказчика (прорабу, начальнику участка) для подписания.
2.2. В случае отказа заказчика подписать смену машинист немедленно фиксирует время и геолокацию в мобильном приложении и уведомляет диспетчера.
2.3. В случае технологического простоя по вине Заказчика (отсутствие фронта работ, задержка материалов, отсутствие разрешений) время простоя оплачивается по ставке 100% от базового почасового тарифа аренды.`
  },
  {
    id: 'doc-2',
    title: 'Утвержденные нормы расхода ГСМ и коэффициенты условий работы',
    category: 'fuel_norms',
    code: 'NORM-FUEL-2026',
    dateUpdated: '2026-10-01',
    excerpt: 'Нормативы часового расхода дизельного топлива для экскаваторов, кранов, погрузчиков и самосвалов.',
    tags: ['ГСМ', 'топливо', 'нормы', 'дизель'],
    fullText: `НОРМАТИВЫ РАСХОДА ТОПЛИВА (л/машино-час):
- Экскаваторы гусеничные 20-22 т (Komatsu PC210, Cat 320, Hyundai 220): базовая норма 16.5 - 18.0 л/ч.
  При тяжелом копании в глине/скальном грунте: повышающий коэффициент K = 1.15 (до 20.7 л/ч).
- Автокраны 25 т (Галичанин, Ивановец на шасси КАМАЗ):
  При крановой работе от КОМ: 13.0 - 14.5 л/ч.
  Транспортный пробег: 38.0 л / 100 км.
- Автокраны 50 т (Liebherr LTM 1050):
  Работа крановой установки: 15.5 - 17.0 л/ч.
- Самосвалы 20 м³ (КАМАЗ 6520, Scania P380):
  В карьере с плечом до 3 км: 18.0 - 20.0 л/ч.
  Транспортный рейс с полной загрузкой: 42.0 л / 100 км.

ПРИМЕЧАНИЕ: Расхождение фактического расхода с нормативным более чем на 10% подлежит обязательной служебной проверке с привлечением службы безопасности.`
  },
  {
    id: 'doc-3',
    title: 'Положение о сдельной оплате труда машинистов и штрафных санкциях',
    category: 'payroll',
    code: 'PAY-RULES-2026',
    dateUpdated: '2026-08-20',
    excerpt: 'Тарифная сетка оплаты машинистов кранов, экскаваторов и водителей самосвалов за смену.',
    tags: ['зарплата', 'табель', 'машинисты', 'штрафы'],
    fullText: `ТАРИФНАЯ СЕТКА МАШИНИСТОВ (руб/час чистыми):
- Машинист автокрана 50т: 700 ₽/час.
- Машинист автокрана 25т: 500 ₽/час.
- Машинист гусеничного экскаватора: 550 ₽/час (при работе гидромолотом +150 ₽/ч).
- Водитель самосвала 20-26 м³: 500 ₽/час (или 450 ₽ за ходку при сдельной схеме плеча до 15 км).
- Машинист автовышки: 500 ₽/час.

ДЕПРЕМИРОВАНИЕ И ШТРАФЫ:
- Несвоевременная передача сменного рапорта диспетчеру (> 24 часов): штраф 1 000 ₽.
- Необоснованный перерасход ГСМ (подтвержденный слив): удержание стоимости топлива в 2-кратном размере.
- Работа с отключенным или заклеенным GPS-трекером: штраф 5 000 ₽ с отстранением от смены.`
  },
  {
    id: 'doc-4',
    title: 'Регламент планового технического обслуживания (ТО-1, ТО-2, ТО-3)',
    category: 'maintenance',
    code: 'MAINT-CYCLE-2026',
    dateUpdated: '2026-07-10',
    excerpt: 'Периодичность техобслуживания техники по наработке моточасов и обязательный состав работ.',
    tags: ['ТО', 'ремонт', 'моточасы', 'сервис'],
    fullText: `ИНТЕРВАЛЫ ОБСЛУЖИВАНИЯ ПО МОТОЧАСАМ:
1. ЕО (ежесменное обслуживание) — проверка уровней масел, охлаждающей жидкости, смазка поворотных узлов, шприцевание стрелы.
2. ТО-1 (250 моточасов) — замена моторного масла, масляного фильтра, топливных фильтров грубой и тонкой очистки, продувка воздушных фильтров.
3. ТО-2 (500 моточасов) — все работы ТО-1 + замена гидравлических сливных фильтров, проверка натяжения гусениц, проверка редукторов хода.
4. ТО-3 (1000 моточасов) — комплексное обслуживание, полная замена гидравлического масла (HVLP 46), антифриза, регулировка зазоров клапанов ДВС.`
  },
  {
    id: 'doc-5',
    title: 'Типовой договор аренды спецтехники с экипажем (редакция 2026)',
    category: 'contracts',
    code: 'CONTRACT-STD-2026',
    dateUpdated: '2026-07-15',
    excerpt: 'Основные положения и полный текст типового договора аренды строительной техники с экипажем в соответствии с ГК РФ.',
    tags: ['договор', 'аренда', 'экипаж', 'закрытие смен'],
    fullText: `ОСНОВНЫЕ ПОЛОЖЕНИЯ ТИПОВОГО ДОГОВОРА АРЕНДЫ С ЭКИПАЖЕМ:
1. Предмет договора: Арендодатель предоставляет Заказчику строительную технику с квалифицированным машинистом и обеспечивает её ГСМ и ТО.
2. Учёт рабочего времени: Минимальная оплачиваемая смена составляет 8 машино-часов. Переработка фиксируется в ЭСМ-7 / сменном рапорте с шагом 30 минут.
3. Перебазировка (трал/перегон): Оплачивается отдельно по согласованному тарифу или при нулевом разрыве начала смены и начала работ на объекте не тарифицируется.
4. Закрывающие документы: Акты, счета и реестры ЭСМ-7 направляются по ЭДО в течение 3 рабочих дней после завершения смены или отчётного периода. Подписание в течение 5 рабочих дней.

================================================================================
ТИПОВОЙ ДОГОВОР АРЕНДЫ СТРОИТЕЛЬНОЙ СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № [НОМЕР]

г. Москва                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

Общество с ограниченной ответственностью «SpecialTech» (вымышленные реквизиты), именуемое в дальнейшем «Арендодатель», в лице Генерального директора Игнатова Виктора Петровича (вымышленное лицо), действующего на основании Устава, с одной стороны, и
[ПОЛНОЕ НАИМЕНОВАНИЕ КОНТРАГЕНТА], именуемое в дальнейшем «Арендатор», в лице [ДОЛЖНОСТЬ И ФИО], действующего на основании [Устава / Доверенности], с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА (ГЛ. 34, СТ. 632–641 ГК РФ)
1.1. Арендодатель обязуется предоставить Арендатору за плату во временное владение и пользование строительную спецтехнику (далее — «Техника») согласно Спецификации (Приложение № 1), а также оказывать своими силами услуги по управлению Техникой и её технической эксплуатации.
1.2. Передача Техники на объект и возврат оформляются Актом приёма-передачи (форма № ОС-1 / акт допуска). Учёт рабочего времени ведётся по сменным рапортам ЭСМ-7 (Постановление Госкомстата РФ от 28.11.1997 № 78) и путевым листам (Приказ Минтранса РФ от 28.09.2022 № 390).

2. ПРАВА И ОБЯЗАННОСТИ СТОРОН, ОХРАНА ТРУДА И ПРОМЫШЛЕННАЯ БЕЗОПАСНОСТЬ
2.1. Арендодатель обеспечивает Технику экипажем, ГСМ, текущим и капитальным ремонтом (ст. 634–636 ГК РФ), а также прохождением предрейсовых медосмотров (ФЗ № 196-ФЗ).
2.2. Арендатор обеспечивает подготовку площадки, ордер/разрешения на земляные работы, передачу схем подземных коммуникаций под роспись прораба, круглосуточную охрану Техники в нерабочее время, а при работе кранов — ППРк и аттестованных стропальщиков (Приказ Ростехнадзора № 461, Приказ Минтруда № 883н).

3. УЧЁТ ВРЕМЕНИ, ПЕРЕГОН И ПРОСТОИ
3.1. Минимальная смена — 8 машино-часов (начало смены 08:00). Переработка учитывается с шагом 30 минут.
3.2. Технологический простой по вине Арендатора (отсутствие фронта работ, ордера, стропальщиков, закрытый въезд) оплачивается по ставке 100% тарифа (ст. 614, п. 2 ст. 781 ГК РФ) и подтверждается актом либо данными ГЛОНАСС.

4. ЦЕНА, ЭДО И РАСЧЁТЫ
4.1. Ставка аренды указывается в Приложении № 1 с учётом НДС 20% (ст. 164 НК РФ).
4.2. УПД / КС-2 / ЭСМ-7 направляются по ЭДО (ФЗ № 63-ФЗ) в течение 3 рабочих дней; Арендатор подписывает их в течение 5 рабочих дней. Оплата — в течение 5 банковских дней. Положения ст. 317.1 и ст. 823 ГК РФ не применяются.

5. ОТВЕТСТВЕННОСТЬ, ЗАВЕРЕНИЯ И СПОРЫ
5.1. За просрочку оплаты — пени 0,1% в день (ст. 330 ГК РФ); при просрочке свыше 10 дней Арендодатель вправе приостановить работу Техники (ст. 328 ГК РФ).
5.2. Ответственность за вред третьим лицам регулируется ст. 640 ГК РФ. Стороны подтверждают налоговую добросовестность (ст. 431.2 ГК РФ, ст. 54.1 НК РФ).
5.3. Форс-мажор подтверждается ТПП РФ (п. 3 ст. 401 ГК РФ). Претензионный порядок — 10 календарных дней (ч. 5 ст. 4 АПК РФ). Подсудность — Арбитражный суд г. Москвы.

6. РЕКВИЗИТЫ СТОРОН (вымышленные)
Арендодатель: ООО «SpecialTech», ИНН 7700912345 / КПП 770001001 / ОГРН 1207700999881,
140090, МО, г. Дзержинский, ул. Энергетиков, д. 14, р/с 40702810900000012345 в АО «Восточно-Столичный Банк», БИК 044525999.
Генеральный директор ___________________ / Игнатов В. П. / (М.П.)`
  },
  {
    id: 'doc-6',
    title: 'Регламент урегулирования споров, претензий и дебиторской задолженности',
    category: 'disputes',
    code: 'DISPUTE-REG-2026',
    dateUpdated: '2026-07-18',
    excerpt: 'Порядок разбора разногласий по часам работы, простою, качеству работ, актам сверки и претензионной работе.',
    tags: ['споры', 'претензии', 'простой', 'арбитраж'],
    fullText: `ПОРЯДОК РАССМОТРЕНИЯ СПОРНЫХ СИТУАЦИЙ И ПРЕТЕНЗИЙ:
1. Споры по отработанным часам и простою:
- Основанием для корректировки служит выгрузка GPS/ГЛОНАСС, данные телеметрии (моточасы, зажигание, геозона объекта) и фотофиксация сменного рапорта.
- Актированный простой по вине Заказчика (нет фронта работ, закрытый въезд, отсутствие прораба) оплачивается в размере 100% ставки смены.
2. Претензионный порядок:
- Срок рассмотрения мотивированного отказа от подписания ЭСМ-7 — 2 рабочих дня с привлечением Fleet Manager и начальника участка.
- При просрочке оплаты свыше 10 календарных дней направляется официальная досудебная претензия и приостанавливается подача техники на объект.
3. Повреждение техники на площадке Заказчика фиксируется двусторонним актом в день инцидента с участием представителя заказчика и инженера по охране труда.`
  },
  {
    id: 'kb-tpl-1',
    title: 'Шаблон: Полный договор аренды спецтехники с экипажем (Юр. лицо, ГК РФ гл. 34)',
    category: 'templates',
    code: 'ШАБ-АРЕНДА-2026',
    dateUpdated: '2026-07-01',
    excerpt: 'Готовый к заполнению шаблон договора с ЮЛ (ОСНО, НДС 20%, ЭСМ-7, УПД/ЭДО, ФНП № 461, ст. 431.2 ГК РФ, ст. 54.1 НК РФ).',
    tags: ['шаблон', 'договор', 'юрлицо', 'ГК РФ'],
    fullText: `ДОГОВОР АРЕНДЫ СТРОИТЕЛЬНОЙ СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № [НОМЕР ДОГОВОРА]

г. [ГОРОД]                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

Общество с ограниченной ответственностью «SpecialTech», именуемое в дальнейшем «Арендодатель», в лице [ДОЛЖНОСТЬ И ФИО ПОДПИСАНТА], действующего на основании [Устава / Доверенности № ...], с одной стороны, и
[ПОЛНОЕ НАИМЕНОВАНИЕ КОНТРАГЕНТА], именуемое в дальнейшем «Арендатор», в лице [ДОЛЖНОСТЬ И ФИО ПОДПИСАНТА], действующего на основании [Устава / Доверенности № ...], с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА (СТ. 632–641 ГК РФ)
1.1. Арендодатель обязуется предоставить Арендатору за плату во временное владение и пользование строительную технику (далее — «Техника») согласно Спецификации (Приложение № 1), а также оказывать своими силами услуги по управлению Техникой и её технической эксплуатации.
1.2. Адрес строительного объекта: [АДРЕС ОБЪЕКТА].
1.3. Передача Техники оформляется Актом приёма-передачи (форма № ОС-1 / акт допуска). Учёт наработки ведётся по сменным рапортам ЭСМ-7 (Постановление Госкомстата РФ № 78) и путевым листам (Приказ Минтранса РФ № 390).

2. ОБЯЗАННОСТИ СТОРОН И БЕЗОПАСНОСТЬ РАБОТ
2.1. Арендодатель обеспечивает Технику экипажем, ГСМ, текущим и капитальным ремонтом (ст. 634–636 ГК РФ), а также предрейсовым медосмотром водителя (ФЗ № 196-ФЗ «О безопасности дорожного движения»).
2.2. Арендатор обязан до начала работ подготовить площадку и подъездные пути, получить ордер/разрешение на земляные работы, передать схемы подземных коммуникаций, обеспечить объект ППРк и аттестованными стропальщиками при работе грузоподъёмных кранов (Приказ Ростехнадзора от 26.11.2020 № 461, Приказ Минтруда РФ № 883н), а также круглосуточную охрану Техники в нерабочее время.

3. РАБОЧЕЕ ВРЕМЯ, ПЕРЕГОН И ПРОСТОЙ
3.1. Минимальная смена — 8 (восемь) машино-часов. Начало дневной смены — 08:00. Переработка сверх 8 часов учитывается с шагом 30 минут.
3.2. Перебазировка тралом оплачивается по согласованному тарифу до выезда (ст. 328 ГК РФ). При совпадении начала смены и начала работ на объекте перегон равен 0 часов.
3.3. Технологический простой по вине Арендатора (отсутствие фронта работ, разрешений, стропальщиков, закрытый въезд) оплачивается по ставке 100% тарифа (ст. 614, п. 2 ст. 781 ГК РФ) и подтверждается актом либо данными ГЛОНАСС.

4. ЦЕНА, ЭДО И ПОРЯДОК РАСЧЁТОВ
4.1. Тариф составляет [СТАВКА] ₽/машино-час, в том числе НДС 20% (ст. 164 НК РФ).
4.2. Закрывающие документы (УПД / КС-2 / ЭСМ-7) направляются через ЭДО (ФЗ № 63-ФЗ) в течение 3 рабочих дней по окончании периода. Срок рассмотрения и подписания Арендатором — 5 рабочих дней; при отсутствии мотивированного отказа услуги считаются принятыми.
4.3. Срок оплаты — 5 (пять) банковских дней с даты выставления счёта. Положения ст. 317.1 и ст. 823 ГК РФ не применяются.

5. ОТВЕТСТВЕННОСТЬ И ЗАВЕРЕНИЯ (СТ. 330, 431.2, 640 ГК РФ, СТ. 54.1 НК РФ)
5.1. За просрочку оплаты — неустойка 0,1% за каждый день просрочки (ст. 330 ГК РФ). При просрочке более 10 календарных дней Арендодатель вправе приостановить работу Техники (ст. 328 ГК РФ).
5.2. Ответственность за вред третьим лицам регулируется ст. 640 ГК РФ (с правом регресса к Арендатору при нарушении ТБ на площадке).
5.3. Стороны гарантируют добросовестность и отражение сделок в налоговой отчётности (ст. 431.2 ГК РФ, ст. 54.1 НК РФ).

6. СПОРЫ И ФОРС-МАЖОР
6.1. Форс-мажор подтверждается ТПП РФ (п. 3 ст. 401 ГК РФ).
6.2. Досудебный претензионный порядок — 10 календарных дней (ч. 5 ст. 4 АПК РФ). Подсудность — Арбитражный суд по месту нахождения Истца (г. Москва / Республика Татарстан).

7. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (вымышленные / подлежащие заполнению)
Арендодатель: ООО «SpecialTech» · ИНН 7700912345 / КПП 770001001 / ОГРН 1207700999881
Р/с 40702810900000012345 в АО «Восточно-Столичный Банк», БИК 044525999
Подпись: ___________________ / [ФИО] / (М.П.)

Арендатор: [НАИМЕНОВАНИЕ КОНТРАГЕНТА] · ИНН [ИНН] / КПП [КПП] / ОГРН [ОГРН]
Р/с [Р/С] в [НАИМЕНОВАНИЕ БАНКА], БИК [БИК]
Подпись: ___________________ / [ФИО] / (М.П.)`
  },
  {
    id: 'kb-tpl-2',
    title: 'Шаблон: Досудебная претензия о взыскании долга, простоя и неустойки (ст. 4 АПК РФ)',
    category: 'templates',
    code: 'ШАБ-ПРЕТЕНЗИЯ-2026',
    dateUpdated: '2026-07-05',
    excerpt: 'Типовая досудебная претензия (ч. 5 ст. 4 АПК РФ) для взыскания задолженности по УПД/КС-2, простоя и пени по ст. 330 ГК РФ.',
    tags: ['шаблон', 'претензия', 'АПК РФ', 'неустойка'],
    fullText: `ДОСУДЕБНАЯ ПРЕТЕНЗИЯ № [НОМЕР]
(направляется в порядке обязательного досудебного урегулирования спора — ч. 5 ст. 4 АПК РФ)

Кому: [ДОЛЖНОСТЬ И ФИО РУКОВОДИТЕЛЯ] [НАИМЕНОВАНИЕ КОНТРАГЕНТА]
Адрес: [ЮРИДИЧЕСКИЙ АДРЕС КОНТРАГЕНТА]
ИНН [ИНН] / ОГРН [ОГРН]

От: ООО «SpecialTech» (ИНН 7700912345 / ОГРН 1207700999881)
Адрес: 140090, Московская обл., г. Дзержинский, ул. Энергетиков, д. 14

Дата: «[ДД]» [МЕСЯЦ] 2026 г.

ПРЕТЕНЗИЯ
по Договору аренды спецтехники с экипажем № [НОМЕР ДОГОВОРА] от [ДАТА ДОГОВОРА]

1. Обстоятельства дела:
ООО «SpecialTech» надлежащим образом исполнило обязательства по предоставлению спецтехники [МАРКА, ИНВ. №] на объект [АДРЕС ОБЪЕКТА], что подтверждается сменными рапортами ЭСМ-7 / путевыми листами № [НОМЕРА], УПД/актами КС-2 № [НОМЕРА] и данными телеметрии ГЛОНАСС.
2. Нарушение обязательств:
В нарушение ст. 309, 310, 614, 781 ГК РФ и условий Договора Арендатор не произвёл оплату оказанных услуг (и/или времени технологического простоя по вине Арендатора) в установленный срок.
3. Расчёт требований:
- Основной долг по актам / простоям: [СУММА ОСНОВНОГО ДОЛГА] ₽;
- Договорная неустойка (0,1% за каждый день просрочки, ст. 330 ГК РФ) за период с [ДАТА] по [ДАТА] ([ДНИ] дн.): [СУММА ПЕНИ] ₽;
ИТОГО к уплате: [ОБЩАЯ СУММА] ₽.

На основании изложенного ТРЕБУЕМ в течение 10 (десяти) календарных дней с даты направления настоящей претензии погасить указанную задолженность путём перечисления на р/с 40702810900000012345 в АО «Восточно-Столичный Банк», БИК 044525999.
При неудовлетворении требований в добровольном порядке спор будет передан в Арбитражный суд с взысканием судебных расходов (ст. 110 АПК РФ) и процентов по ст. 395 ГК РФ.

Приложения: 1. Копия договора и спецификации. 2. Реестр ЭСМ-7 / ПЛ и УПД. 3. Отчёт ГЛОНАСС.

Представитель по доверенности ___________________ / [ФИО] /`
  },
  {
    id: 'kb-tpl-3',
    title: 'Шаблон: Договор-заявка на услуги спецтехники с физ. лицом (ИП, УСН без НДС)',
    category: 'templates',
    code: 'ШАБ-ФИЗЛИЦО-2026',
    dateUpdated: '2026-07-05',
    excerpt: 'Шаблон для физических лиц через ИП «SpecialTechnica» (УСН, гл. 39 ГК РФ, Закон № 2300-1, чек ФЗ-54, согласие ПДн ФЗ-152).',
    tags: ['шаблон', 'физлицо', 'ИП', 'ФЗ-152'],
    fullText: `ДОГОВОР-ЗАЯВКА НА ОКАЗАНИЕ УСЛУГ СПЕЦТЕХНИКОЙ № [НОМЕР]
(для Заказчиков — физических лиц, гл. 39 ГК РФ, Закон РФ от 07.02.1992 № 2300-1)

г. [ГОРОД]                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

Индивидуальный предприниматель «SpecialTechnica» (вымышленное наименование ИП Соколовский Антон Владимирович, ОГРНИП 322508100077889, ИНН 502700889911), применяющий упрощённую систему налогообложения (УСН, без НДС в соответствии с гл. 26.2 / ст. 145 НК РФ), именуемый в дальнейшем «Исполнитель», с одной стороны, и
Гражданин(ка) РФ [ФИО ЗАКАЗЧИКА ПОЛНОСТЬЮ], паспорт серия [ХХХХ] № [ХХХХХХ], выдан [ОРГАН И ДАТА ВЫДАЧИ], зарегистрированный(ая) по адресу: [АДРЕС РЕГИСТРАЦИИ], тел. [ТЕЛЕФОН], именуемый(ая) в дальнейшем «Заказчик», с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА (СТ. 779 ГК РФ)
1.1. Исполнитель обязуется по заявке Заказчика оказать услуги строительной спецтехникой [МАРКА И ТИП ТЕХНИКИ] с экипажем и ГСМ на земельном участке Заказчика по адресу: [АДРЕС ОБЪЕКТА], а Заказчик обязуется принять и оплатить оказанные услуги.
1.2. Настоящий Договор не является договором строительного подряда: Исполнитель выполняет технологические операции по указанию Заказчика на объекте (планировка, копка, погрузка) без принятия рисков проектных решений и скрытых инженерных сетей.

2. УСЛОВИЯ НА УЧАСТКЕ И БЕЗОПАСНОСТЬ
2.1. Заказчик гарантирует наличие свободного подъезда шириной не менее 3,5 м, твёрдого грунта и отсутствие посторонних лиц (включая детей и животных) в радиусе опасной зоны работы стрелы/ковша.
2.2. Заказчик обязан до начала земляных работ указать на местности точное прохождение частных и магистральных коммуникаций (электрокабель, газ, водопровод, септик). При непредоставлении сведений ответственность за повреждение скрытых коммуникаций несёт Заказчик.

3. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ (ФЗ № 54-ФЗ)
3.1. Минимальный заказ составляет [8] машино-часов по ставке [СТАВКА] ₽/час. Итого стоимость минимальной смены: [СУММА] ₽ (НДС не облагается, УСН).
3.2. Подача/перебазировка техники на участок составляет [СУММА ПОДАЧИ] ₽.
3.3. Оплата производится Заказчиком до начала работы (предоплата минимальной смены и подачи) либо по факту окончания смены наличными / по СБП / на расчётный счёт Исполнителя с обязательной выдачей кассового чека (ФЗ от 22.05.2003 № 54-ФЗ) и подписанием Акта (путевого листа).

4. СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ (ФЗ № 152-ФЗ)
4.1. Подписывая настоящий Договор, Заказчик в соответствии со ст. 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» даёт согласие Исполнителю на обработку своих персональных данных (ФИО, телефон, паспортные данные, адрес объекта) исключительно в целях исполнения настоящего Договора и оформления закрывающих документов.

5. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (вымышленные)
Исполнитель: ИП «SpecialTechnica» (ИП Соколовский А. В.)
ИНН 502700889911 / ОГРНИП 322508100077889
Р/с 40802810200000044556 в АО «Восточно-Столичный Банк», БИК 044525999
Подпись: ___________________ / ИП Соколовский А. В. /

Заказчик (Физ. лицо): [ФИО ЗАКАЗЧИКА]
Паспорт: [СЕРИЯ И НОМЕР] · Тел.: [ТЕЛЕФОН]
Подпись: ___________________ / [ФИО] /`
  },
  {
    id: 'kb-tpl-4',
    title: 'Шаблон: Договор субаренды (привлечения) техники частника (ИП / Самозанятый НПД)',
    category: 'templates',
    code: 'ШАБ-СУБАРЕНДА-ЧАСТНИК-2026',
    dateUpdated: '2026-07-18',
    excerpt: 'Шаблон привлечения частного владельца со своей техникой (ст. 632–641 ГК РФ, ФЗ № 422-ФЗ НПД, запрет обхода клиентов).',
    tags: ['шаблон', 'субаренда', 'частник', 'НПД'],
    fullText: `ДОГОВОР ПРИВЛЕЧЕНИЯ (СУБАРЕНДЫ) СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № [НОМЕР]
(привлечение частного владельца со своей техникой — ИП или плательщика НПД по ФЗ № 422-ФЗ)

г. [ГОРОД]                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

[ИП ФИО / Гражданин РФ ФИО, плательщик налога на профессиональный доход (самозанятый) по ФЗ от 27.11.2018 № 422-ФЗ], именуемый в дальнейшем «Исполнитель (Владелец техники)», с одной стороны, и
ООО «SpecialTech» (ИНН 7700912345), именуемое в дальнейшем «Заказчик», с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Исполнитель предоставляет Заказчику собственную (или законно арендуемую) строительную технику [МАРКА, ГОСНОМЕР] с управлением и техническим обслуживанием своими силами (ст. 632–641 ГК РФ) для работы на объектах клиентов Заказчика.
1.2. Договор регулируется исключительно гражданским законодательством РФ. Стороны не состоят в трудовых отношениях; Исполнитель самостоятельно определяет режим своего отдыха, несёт расходы по ГСМ, ремонту и страхованию своей техники.

2. СТАВКА И ПОРЯДОК ВЫПЛАТЫ
2.1. Закупочная ставка для Исполнителя составляет [СТАВКА ПОДРЯДЧИКА] ₽/машино-час (без НДС).
2.2. Сменные рапорты ЭСМ-7 с подписью представителя объекта передаются диспетчеру Заказчика в течение 24 часов после смены.
2.3. Выплата вознаграждения производится в течение [5] банковских дней после подписания сводного Акта за месяц/период и поступления оплаты от конечного клиента (либо не позднее [20] календарных дней).
2.4. Если Исполнитель применяет специальный налоговый режим НПД (ФЗ № 422-ФЗ), Исполнитель обязан в момент получения оплаты сформировать и передать Заказчику чек в приложении «Мой налог» (ч. 1 ст. 14 ФЗ № 422-ФЗ), а при утрате статуса плательщика НПД — уведомить Заказчика в течение 3 рабочих дней под угрозой возмещения налоговых потерь (ст. 406.1 ГК РФ).

3. ОТВЕТСТВЕННОСТЬ И НЕПЕРЕМАНИВАНИЕ
3.1. Ответственность перед третьими лицами регулируется ст. 640 ГК РФ.
3.2. Запрет прямых сделок с объектами и клиентами Заказчика в течение 12 месяцев (штраф [150 000] ₽).

4. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (вымышленные / для заполнения)
Заказчик: ООО «SpecialTech», ИНН 7700912345 / КПП 770001001, р/с 40702810900000012345
Исполнитель (Частник): [ФИО / ИП], ИНН [ИНН], паспорт/ОГРНИП [ДАННЫЕ], р/с или карта [РЕКВИЗИТЫ]

Заказчик: ___________________ / [ФИО] /       Исполнитель: ___________________ / [ФИО] /`
  }
];

export const initialChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    branchId: 'branch-hq',
    dealId: 'deal-1',
    senderName: 'Захаров Р. О. (ООО «Монолит-Строй»)',
    senderRole: 'client',
    text: 'Добрый день! Направляем карточку реквизитов для выставления счёта в ООО «SpecialTech» и фото заезда на площадку Дмитровское ш., 82.',
    timestamp: '09:15',
    attachment: {
      id: 'att-1',
      name: 'Реквизиты_ООО_Монолит_Строй.pdf',
      size: 245760,
      mimeType: 'application/pdf',
      category: 'requisites'
    }
  },
  {
    id: 'msg-2',
    branchId: 'branch-hq',
    dealId: 'deal-1',
    senderName: 'Соколов В. П. (Машинист Komatsu PC210)',
    senderRole: 'driver',
    text: 'На объекте ЖК «Северный квартал» отработал смену, сделал фото площадки и счётчика моточасов на конец смены.',
    timestamp: '18:05',
    attachment: {
      id: 'att-2',
      name: 'Фото_объекта_Северный_квартал.jpg',
      size: 1482000,
      mimeType: 'image/jpeg',
      category: 'site_photo'
    }
  },
  {
    id: 'msg-3',
    branchId: 'branch-hq',
    senderName: 'Орлов П. С. (Fleet Manager)',
    senderRole: 'fleet_manager',
    text: 'Принято. Ждём разрешение администратора на закрытие смены SH-MSK-409 и подтверждение часов.',
    timestamp: '18:12'
  },
  {
    id: 'msg-kzn-1',
    branchId: 'branch-kzn',
    dealId: 'deal-kzn-1',
    senderName: 'Халиуллин М. Р. (ООО «ТатСтройМост»)',
    senderRole: 'client',
    text: 'Отправили обновлённые реквизиты и фото подъездных путей на М-12 км 74. Самосвалы выполнили 14 рейсов.',
    timestamp: '10:30',
    attachment: {
      id: 'att-kzn-1',
      name: 'Карточка_предприятия_ТатСтройМост.docx',
      size: 184320,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category: 'requisites'
    }
  },
  {
    id: 'msg-kzn-2',
    branchId: 'branch-kzn',
    senderName: 'Волков И. А. (Fleet Manager)',
    senderRole: 'fleet_manager',
    text: 'Подтверждение рейсов и закрытие смены SH-KZN-102 активируется после согласования администратором.',
    timestamp: '11:04'
  }
];

export const initialDrivers: DriverProfile[] = [
  // Главный парк (MSK) — eq-1 имеет 2 водителей (выбор смены по табелю)
  {
    id: 'drv-1',
    branchId: 'branch-hq',
    name: 'Соколов В. П.',
    phone: '+7 (916) 510-22-01',
    maxLinked: true,
    cardLast4: '4819',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-1'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-1b',
    branchId: 'branch-hq',
    name: 'Тимофеев А. Г.',
    phone: '+7 (916) 510-22-02',
    maxLinked: true,
    cardLast4: '4820',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-1'],
    shiftRoster: 'shift_2'
  },
  // eq-2 имеет 2 водителей (выбор смены по табелю)
  {
    id: 'drv-2',
    branchId: 'branch-hq',
    name: 'Кузнецов А. М.',
    phone: '+7 (926) 441-18-09',
    maxLinked: true,
    cardLast4: '1809',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-2'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-2b',
    branchId: 'branch-hq',
    name: 'Белов К. Н.',
    phone: '+7 (926) 441-18-10',
    maxLinked: true,
    cardLast4: '1810',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-2'],
    shiftRoster: 'shift_2'
  },
  // 1 привязанный водитель по умолчанию
  {
    id: 'drv-3',
    branchId: 'branch-hq',
    name: 'Михайлов И. Р.',
    phone: '+7 (903) 782-90-14',
    maxLinked: true,
    cardLast4: '9014',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-3', 'eq-9'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-4',
    branchId: 'branch-hq',
    name: 'Васильев О. С.',
    phone: '+7 (915) 602-31-45',
    maxLinked: true,
    cardLast4: '3145',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-4', 'eq-11'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-5',
    branchId: 'branch-hq',
    name: 'Григорьев С. М.',
    phone: '+7 (925) 319-77-20',
    maxLinked: true,
    cardLast4: '7720',
    cardLimitRub: 180000,
    assignedEquipmentIds: ['eq-5'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-6',
    branchId: 'branch-hq',
    name: 'Попов Д. В.',
    phone: '+7 (916) 890-12-33',
    maxLinked: true,
    cardLast4: '1233',
    cardLimitRub: 180000,
    assignedEquipmentIds: ['eq-6'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-7',
    branchId: 'branch-hq',
    name: 'Никитин Р. А.',
    phone: '+7 (909) 244-56-81',
    maxLinked: true,
    cardLast4: '5681',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-7'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-8',
    branchId: 'branch-hq',
    name: 'Семёнов П. И.',
    phone: '+7 (910) 533-40-19',
    maxLinked: true,
    cardLast4: '4019',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-8'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-9',
    branchId: 'branch-hq',
    name: 'Крылов Е. В.',
    phone: '+7 (905) 611-28-94',
    maxLinked: true,
    cardLast4: '2894',
    cardLimitRub: 120000,
    assignedEquipmentIds: ['eq-10'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-10',
    branchId: 'branch-hq',
    name: 'Федотов Н. А.',
    phone: '+7 (929) 704-15-62',
    maxLinked: true,
    cardLast4: '1562',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-12'],
    shiftRoster: 'shift_1'
  },
  // Филиал «Поволжье» (KZN) — eq-kzn-1 имеет 2 водителей
  {
    id: 'drv-kzn-1',
    branchId: 'branch-kzn',
    name: 'Сафиуллин Р. Ф.',
    phone: '+7 (917) 250-44-01',
    maxLinked: true,
    cardLast4: '4401',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-kzn-1'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-kzn-1b',
    branchId: 'branch-kzn',
    name: 'Нуруллин И. М.',
    phone: '+7 (917) 250-44-02',
    maxLinked: true,
    cardLast4: '4402',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-kzn-1'],
    shiftRoster: 'shift_2'
  },
  {
    id: 'drv-kzn-2',
    branchId: 'branch-kzn',
    name: 'Галеев Д. Ш.',
    phone: '+7 (987) 412-88-15',
    maxLinked: true,
    cardLast4: '8815',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-kzn-2'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-kzn-3',
    branchId: 'branch-kzn',
    name: 'Мухаметшин А. Н.',
    phone: '+7 (927) 609-33-70',
    maxLinked: true,
    cardLast4: '3370',
    cardLimitRub: 180000,
    assignedEquipmentIds: ['eq-kzn-3'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-kzn-4',
    branchId: 'branch-kzn',
    name: 'Закиров Т. М.',
    phone: '+7 (917) 831-19-04',
    maxLinked: true,
    cardLast4: '1904',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-kzn-4'],
    shiftRoster: 'shift_1'
  },
  {
    id: 'drv-kzn-5',
    branchId: 'branch-kzn',
    name: 'Хасанов Р. И.',
    phone: '+7 (937) 522-71-29',
    maxLinked: true,
    cardLast4: '7129',
    cardLimitRub: 150000,
    assignedEquipmentIds: ['eq-kzn-5'],
    shiftRoster: 'shift_1'
  }
];

export const initialLegalDocuments: LegalDocument[] = [
  {
    id: 'leg-1',
    number: 'ДОГ-МСК-2026/014',
    title: 'Договор аренды спецтехники с экипажем № ДОГ-МСК-2026/014 (ООО «Монолит-Строй»)',
    kind: 'contract',
    branchId: 'branch-hq',
    counterparty: 'ООО «Монолит-Строй»',
    accountingSubject: 'ooo_specialtech',
    status: 'active',
    createdAt: '2026-06-05',
    updatedAt: '2026-07-12',
    authorName: 'Воронова Е. В. (Юрист)',
    amountRub: 1850000,
    linkedOrderNumber: 'RO-MSK-26-014',
    inKnowledgeBase: true,
    content: `ДОГОВОР АРЕНДЫ СТРОИТЕЛЬНОЙ СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № ДОГ-МСК-2026/014

г. Москва                                                                  «05» июня 2026 г.

Общество с ограниченной ответственностью «SpecialTech» (ООО «SpecialTech»), именуемое в дальнейшем «Арендодатель», в лице Генерального директора Игнатова Виктора Петровича (вымышленное лицо), действующего на основании Устава, с одной стороны, и
Общество с ограниченной ответственностью «Монолит-Строй» (ООО «Монолит-Строй»), именуемое в дальнейшем «Арендатор», в лице Генерального директора Захарова Романа Олеговича (вымышленное лицо), действующего на основании Устава, с другой стороны, вместе именуемые «Стороны», а по отдельности — «Сторона», заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. В соответствии со ст. 632–641 Гражданского кодекса Российской Федерации (ГК РФ) Арендодатель обязуется предоставить Арендатору за плату во временное владение и пользование строительную спецтехнику (далее — «Техника») согласно Спецификации (Приложение № 1), а также оказывать своими силами услуги по управлению Техникой и по её технической эксплуатации (экипажем Арендодателя).
1.2. Наименование, марка, инвентарный номер, государственный регистрационный знак, стоимость машино-часа, адрес строительного объекта (ЖК «Северный квартал», г. Москва, Дмитровское ш., вл. 82) и срок аренды согласовываются Сторонами в Спецификации и заявках.
1.3. Техника передаётся на объект Арендатора и возвращается с объекта на основании двустороннего Акта приёма-передачи (унифицированная форма № ОС-1 / акт допуска), а учёт времени работы ведётся по сменным рапортам (форма № ЭСМ-7, утв. Постановлением Госкомстата РФ от 28.11.1997 № 78) и путевым листам (Приказ Минтранса РФ от 28.09.2022 № 390).

2. СРОК ДЕЙСТВИЯ ДОГОВОРА И ПЕРЕБАЗИРОВКА
2.1. Договор вступает в силу с момента его подписания Сторонами и действует до «31» декабря 2026 г., а в части взаиморасчётов и ответственности — до полного исполнения Сторонами своих обязательств.
2.2. Доставка (перебазировка) гусеничной и негабаритной Техники на объект Арендатора и обратный вывоз осуществляются силами Арендодателя специализированным низкорамным тралом за счёт Арендатора по тарифу, указанному в Приложении № 1, при предоплате 100% до выезда с базы (ст. 328 ГК РФ). Если перегон к объекту не осуществляется или время начала смены (08:00) совпадает с началом работ на объекте, перегон отдельно не тарифицируется.

3. ПРАВА И ОБЯЗАННОСТИ СТОРОН. ОХРАНА ТРУДА И ПРОМЫШЛЕННАЯ БЕЗОПАСНОСТЬ
3.1. Арендодатель обязан (ст. 634, 635 ГК РФ):
   а) предоставить Технику в технически исправном состоянии, прошедшую государственную регистрацию (Гостехнадзор / ГИБДД) и плановое ТО;
   б) обеспечить управление Техникой квалифицированным машинистом (оператором), прошедшим предрейсовый медицинский осмотр и имеющим действующее удостоверение тракториста-машиниста;
   в) нести расходы по обеспечению Техники горюче-смазочными материалами (ГСМ), расходными материалами, текущему и капитальному ремонту (ст. 634, 636 ГК РФ).
3.2. Арендатор обязан:
   а) до начала работ подготовить площадку с прочным основанием, организовать освещение, подъездные пути, оформление ордера ОАТИ и разрешений на производство земляных работ (в соответствии с Приказом Минтруда РФ № 883н от 11.12.2020 «Правила по охране труда при строительстве»);
   б) назначить приказом лицо, ответственное за безопасное производство работ на объекте, провести целевой инструктаж на объекте экипажу Арендодателя, предоставить схемы расположения подземных коммуникаций (кабели, газопроводы, теплосети) под роспись прораба;
   в) обеспечить сохранность Техники на объекте в нерабочее время (круглосуточная охрана, видеонаблюдение, КПП);
   г) ежедневно по окончании смены обеспечивать подписание уполномоченным представителем (прорабом) сменного рапорта ЭСМ-7 / путевого листа с указанием фактически отработанных часов, простоя и перегона.

4. ПОРЯДОК УЧЁТА РАБОЧЕГО ВРЕМЕНИ И ПРОСТОЕВ
4.1. Минимальная продолжительность оплачиваемой дневной смены составляет 8 (восемь) машино-часов (начало смены 08:00, перерыв на обед 12:00–13:00 не входит в оплачиваемое время). Переработка сверх 8 часов учитывается с шагом 0,5 (полчаса).
4.2. При отказе представителя Арендатора от подписания сменного рапорта ЭСМ-7 без предоставления в течение 2 (двух) рабочих дней письменного мотивированного возражения, время работы Техники считается подтверждённым по данным бортовой телеметрии ГЛОНАСС/GPS и счёту Арендодателя.
4.3. Технологический простой Техники на объекте по вине Арендатора (отсутствие фронта работ, ордера на земляные работы, стропальщиков, материалов, закрытый въезд, запрет по погодным условиям при нахождении Техники в готовности на объекте) оформляется двусторонним актом о простое либо фиксируется данными ГЛОНАСС в геозоне объекта и подлежит оплате в размере 100% почасовой ставки (ст. 614, п. 2 ст. 781 ГК РФ).

5. ЦЕНА ДОГОВОРА И ПОРЯДОК РАСЧЁТОВ
5.1. Ориентировочная сумма настоящего Договора составляет 1 850 000 (Один миллион восемьсот пятьдесят тысяч) рублей 00 копеек, в том числе НДС 20% — 308 333,33 рубля (ст. 164 НК РФ).
5.2. Базовая ставка аренды экскаватора Komatsu PC210NLC-8 (инв. № EXC-14) составляет 3 400,00 рублей за 1 машино-час, в том числе НДС 20%.
5.3. Отчётным периодом являются каждые 14 (четырнадцать) календарных дней и/или календарный месяц. Арендодатель в течение 3 (трёх) рабочих дней по окончании отчётного периода направляет Арендатору по системе ЭДО (ФЗ от 06.04.2011 № 63-ФЗ) Универсальный передаточный документ (УПД) или Акт (КС-2/ЭСМ-7) и счёт на оплату.
5.4. Арендатор обязан рассмотреть и подписать закрывающие документы в ЭДО в течение 5 (пяти) рабочих дней со дня получения либо направить мотивированный отказ. При отсутствии отказа в указанный срок услуги считаются принятыми в полном объёме (ст. 753, 783 ГК РФ).
5.5. Оплата производится безналичным перечислением на расчётный счёт Арендодателя в течение 5 (пяти) банковских дней с даты выставления счёта. Проценты по ст. 317.1 и ст. 823 ГК РФ на суммы авансов и отсрочек не начисляются.

6. ОТВЕТСТВЕННОСТЬ СТОРОН
6.1. За просрочку оплаты счетов Арендодатель вправе начислить Арендатору неустойку (пени) в размере 0,1% от суммы просроченного платежа за каждый календарный день просрочки (ст. 330 ГК РФ), а при просрочке свыше 10 календарных дней — приостановить работу Техники на объекте с отнесением времени простоя на счёт Арендатора (ст. 328 ГК РФ).
6.2. Ответственность за вред, причинённый третьим лицам арендованной Техникой, несёт Арендодатель в порядке ст. 640 ГК РФ. Арендодатель вправе предъявить к Арендатору регрессное требование о возмещении сумм, выплаченных третьим лицам, если вред возник по вине Арендатора (включая отсутствие схем коммуникаций, допуск в опасную зону посторонних лиц, нарушение ТБ на площадке).
6.3. Арендатор несёт полную материальную ответственность за повреждение, разукомплектование или утрату Техники, произошедшие на территории объекта Арендатора в период между сменами (в нерабочее время экипажа) либо вследствие ненадлежащей охраны и организации площадки.

7. ЗАВЕРЕНИЯ ОБ ОБСТОЯТЕЛЬСТВАХ И НАЛОГОВАЯ ОГОВОРКА (СТ. 431.2 ГК РФ, СТ. 54.1 НК РФ)
7.1. Стороны заверяют друг друга в порядке ст. 431.2 ГК РФ, что обладают полной правоспособностью, необходимыми ресурсами, не находятся в стадии ликвидации или банкротства, своевременно сдают налоговую отчётность и отражают операции по настоящему Договору в бухгалтерском и налоговом учёте (ст. 54.1 НК РФ).

8. ОБСТОЯТЕЛЬСТВА НЕПРЕОДОЛИМОЙ СИЛЫ (ФОРС-МАЖОР)
8.1. Стороны освобождаются от ответственности за неисполнение обязательств вследствие обстоятельств непреодолимой силы (п. 3 ст. 401 ГК РФ), подтверждённых справкой ТПП РФ, при условии письменного уведомления другой Стороны в течение 3 (трёх) рабочих дней.

9. РАЗРЕШЕНИЕ СПОРОВ
9.1. Все споры разрешаются с соблюдением обязательного досудебного претензионного порядка (ч. 5 ст. 4 АПК РФ). Срок рассмотрения претензии — 10 (десять) календарных дней с даты её направления по юридическому адресу или через ЭДО.
9.2. При недостижении согласия спор подлежит передаче на рассмотрение в Арбитражный суд города Москвы (ст. 37 АПК РФ).

10. ПРИЛОЖЕНИЯ И РЕКВИЗИТЫ СТОРОН
Приложение № 1 — Спецификация техники (Komatsu PC210NLC-8, инв. EXC-14, госномер E 384 CB 777, ставка 3 400 ₽/ч, трал 25 000 ₽ в одну сторону).

Арендодатель:
ООО «SpecialTech» (вымышленные реквизиты для шаблона)
Юр. адрес: 140090, Московская обл., г. Дзержинский, ул. Энергетиков, д. 14, пом. 12
ИНН 7700912345 / КПП 770001001 / ОГРН 1207700999881
Р/с 40702810900000012345 в АО «Восточно-Столичный Банк» г. Москва
К/с 30101810400000000999, БИК 044525999
Тел.: +7 (495) 000-12-01, E-mail: legal@specialtech-demo.ru
Генеральный директор ___________________ / Игнатов В. П. / (М.П.)

Арендатор:
ООО «Монолит-Строй» (вымышленные реквизиты)
Юр. адрес: 127474, г. Москва, Дмитровское ш., д. 82, стр. 3, оф. 405
ИНН 7713998877 / КПП 771301001 / ОГРН 1187746990112
Р/с 40702810100000054321 в ПАО «Столичный ПромБанк» г. Москва
К/с 30101810200000000888, БИК 044525888
Тел.: +7 (495) 000-44-88, E-mail: docs@monolit-demo.ru
Генеральный директор ___________________ / Захаров Р. О. / (М.П.)`
  },
  {
    id: 'leg-2',
    number: 'ДОГ-КЗН-2026/009',
    title: 'Договор оказания услуг спецтехникой на М-12 № ДОГ-КЗН-2026/009 (ООО «ТатСтройМост»)',
    kind: 'contract',
    branchId: 'branch-kzn',
    counterparty: 'ООО «ТатСтройМост»',
    accountingSubject: 'ooo_specialtech',
    status: 'active',
    createdAt: '2026-06-18',
    updatedAt: '2026-07-16',
    authorName: 'Воронова Е. В. (Юрист)',
    amountRub: 2420000,
    linkedOrderNumber: 'RO-KZN-26-009',
    inKnowledgeBase: true,
    content: `ДОГОВОР АРЕНДЫ СПЕЦТЕХНИКИ С ЭКИПАЖЕМ (И ОКАЗАНИЯ УСЛУГ МЕХАНИЗМАМИ) № ДОГ-КЗН-2026/009

г. Казань                                                                  «18» июня 2026 г.

Общество с ограниченной ответственностью «SpecialTech» (филиал «Поволжье», подразделение ПОДР-КЗН-02), именуемое в дальнейшем «Исполнитель (Арендодатель)», в лице руководителя филиала Волкова Игоря Андреевича (вымышленное лицо), действующего на основании Доверенности № Д-26/04 от 12.01.2026, с одной стороны, и
Общество с ограниченной ответственностью «ТатСтройМост» (ООО «ТатСтройМост»), именуемое в дальнейшем «Заказчик (Арендатор)», в лице Директора Халиуллина Марата Рамилевича (вымышленное лицо), действующего на основании Устава, с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. В порядке главы 34 (§ 3, ст. 632–641 ГК РФ) и главы 39 (ст. 779–783 ГК РФ) ГК РФ Исполнитель обязуется предоставлять Заказчику строительную и грузоподъёмную технику (автокраны 50 т и 25 т, самосвалы 20 м³) с квалифицированным экипажем, ГСМ и техническим обслуживанием для производства строительно-монтажных и дорожных работ на объекте: «Строительство участка автодороги М-12, км 74 (Республика Татарстан)».

2. ТРЕБОВАНИЯ ПРОМЫШЛЕННОЙ БЕЗОПАСНОСТИ (ФНП ПОДЪЁМНЫХ СООРУЖЕНИЙ)
2.1. При работе грузоподъёмных кранов Заказчик обязан неукоснительно соблюдать Федеральные нормы и правила в области промышленной безопасности «Правила безопасности опасных производственных объектов, на которых используются подъёмные сооружения» (утв. Приказом Ростехнадзора от 26.11.2020 № 461), в том числе:
   а) разработать и передать Исполнителю под роспись ППРк (проект производства работ с применением подъёмных сооружений) или ТК (технологическую карту) до начала работ;
   б) назначить приказом лицо, ответственное за безопасное производство работ с применением ПС, и обеспечить площадку аттестованными стропальщиками с соответствующими удостоверениями и сертифицированными грузозахватными приспособлениями;
   в) при работе вблизи ЛЭП — оформить и выдать наряд-допуск установленного образца.
2.2. Машинист автокрана имеет право прекратить работу при отсутствии ППРк, стропальщика, наряда-допуска в зоне ЛЭП или при скорости ветра, превышающей паспортные ограничения крана; время вынужденного ожидания оформляется простоем по вине Заказчика.

3. УЧЁТ ОБЪЁМОВ И ПУТЕВЫЕ ЛИСТЫ
3.1. Учёт работы автокранов ведётся в машино-часах по сменным рапортам (форма ЭСМ-7) с минимальной сменой 8 часов.
3.2. Учёт работы самосвалов ведётся по путевым листам серии ПЛ-КЗН- (ФЗ от 08.11.2007 № 259-ФЗ «Устав автомобильного транспорта и городского наземного электрического транспорта», Постановление Правительства РФ от 21.12.2020 № 2200, Приказ Минтранса РФ № 390) с фиксацией количества подтверждённых рейсов, тоннажа/объёма и времени на линии.

4. ЦЕНА И ПОРЯДОК ОПЛАТЫ
4.1. Общая предельная цена Договора составляет 2 420 000 (Два миллиона четыреста двадцать тысяч) рублей 00 копеек, в т.ч. НДС 20% — 403 333,33 рубля.
4.2. Отчётность и закрытие актов: каждые 15 календарных дней Исполнитель формирует в ЭДО УПД, реестр путевых листов ПЛ-КЗН- и ЭСМ-7. Срок подписания Заказчиком — 5 (пять) рабочих дней.
4.3. Оплата производится в течение 5 (пяти) банковских дней с даты выставления счёта и УПД/КС-2. При просрочке начисляется неустойка 0,1% в день (ст. 330 ГК РФ).

5. РАЗРЕШЕНИЕ СПОРОВ И ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
5.1. Обязательный досудебный претензионный порядок — 10 календарных дней (ч. 5 ст. 4 АПК РФ). Неурегулированные споры рассматриваются в Арбитражном суде Республики Татарстан (ст. 37 АПК РФ).
5.2. Стороны подтверждают достоверность сведений в ЕГРЮЛ и соблюдение требований ст. 54.1 НК РФ и ст. 431.2 ГК РФ.

6. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН
Исполнитель (Арендодатель):
ООО «SpecialTech» — Филиал «Поволжье» (вымышленные реквизиты)
Адрес базы филиала: 420054, г. Казань, ул. Техническая, д. 52, база № 2
ИНН 7700912345 / КПП 165943001 / ОГРН 1207700999881
Р/с 40702810700000077112 в Поволжском филиале АО «Восточно-Столичный Банк»
К/с 30101810600000000777, БИК 049205777
Руководитель филиала (по дов. № Д-26/04) _____________ / Волков И. А. / (М.П.)

Заказчик (Арендатор):
ООО «ТатСтройМост» (вымышленные реквизиты)
Юр. адрес: 420107, г. Казань, ул. Спартаковская, д. 119, оф. 210
ИНН 1655998877 / КПП 165501001 / ОГРН 1161690887766
Р/с 40702810400000066554 в ПАО «Камский КоммерцБанк» г. Казань
К/с 30101810500000000666, БИК 049205666
Директор ___________________________________ / Халиуллин М. Р. / (М.П.)`
  },
  {
    id: 'leg-3',
    number: 'ДС-МСК-2026/014-1',
    title: 'Дополнительное соглашение № 1 к Договору № ДОГ-МСК-2026/014 (продление и тариф перегона)',
    kind: 'addendum',
    branchId: 'branch-hq',
    counterparty: 'ООО «Монолит-Строй»',
    accountingSubject: 'ooo_specialtech',
    status: 'review',
    createdAt: '2026-07-14',
    updatedAt: '2026-07-18',
    authorName: 'Воронова Е. В. (Юрист)',
    amountRub: 420000,
    linkedOrderNumber: 'RO-MSK-26-014',
    inKnowledgeBase: false,
    content: `ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ № 1
к Договору аренды строительной спецтехники с экипажем № ДОГ-МСК-2026/014 от «05» июня 2026 г.

г. Москва                                                                  «14» июля 2026 г.

ООО «SpecialTech» (Арендодатель), в лице Генерального директора Игнатова Виктора Петровича (вымышленное лицо), действующего на основании Устава, и
ООО «Монолит-Строй» (Арендатор), в лице Генерального директора Захарова Романа Олеговича (вымышленное лицо), действующего на основании Устава, на основании ст. 450 и ст. 452 ГК РФ заключили настоящее Дополнительное соглашение о нижеследующем:

1. Стороны согласовали продление срока работы гусеничного экскаватора Komatsu PC210NLC-8 (инв. № EXC-14) на объекте ЖК «Северный квартал» на дополнительный объём — 120 (сто двадцать) машино-часов.
2. Стоимость дополнительного объёма услуг составляет 408 000,00 рублей + согласованный резерв на переработку и навесное оборудование 12 000,00 рублей, итого 420 000 (Четыреста двадцать тысяч) рублей 00 копеек, в том числе НДС 20% — 70 000,00 рублей.
3. Изложить п. 2.2 Договора в части тарификации перегона техники в следующей редакции:
   «При нахождении Техники на объекте и совпадении времени начала смены (08:00) с началом работ на объекте время перегона принимается равным 0 (ноль) часов и дополнительной оплате не подлежит. Самостоятельный перегон колёсной техники между удалёнными объектами Арендатора оплачивается по согласованному тарифу 2 500 руб./час (в т.ч. НДС 20%).»
4. Подтверждение закрытия смен и объёмов (часов / рейсов) может дополнительно фиксироваться через авторизованный канал уведомлений Заказчика (сервис «MAX») с последующим отражением в форме ЭСМ-7 и УПД в системе ЭДО.
5. Во всём остальном, что не изменено настоящим Дополнительным соглашением, условия Договора № ДОГ-МСК-2026/014 от «05» июня 2026 г. остаются без изменений и сохраняют юридическую силу.
6. Настоящее Дополнительное соглашение составлено в двух экземплярах (либо подписано УКЭП в системе ЭДО согласно ФЗ № 63-ФЗ) и является неотъемлемой частью Договора.

ПОДПИСИ И РЕКВИЗИТЫ СТОРОН:
Арендодатель: ООО «SpecialTech» (ИНН 7700912345 / КПП 770001001)
Генеральный директор ___________________ / Игнатов В. П. / (М.П.)

Арендатор: ООО «Монолит-Строй» (ИНН 7713998877 / КПП 771301001)
Генеральный директор ___________________ / Захаров Р. О. / (М.П.)`
  },
  {
    id: 'leg-4',
    number: 'СПР-МСК-2026/003',
    title: 'Досудебная претензия по простою 24 м/ч Komatsu PC210 (ООО «ГрандСтройИнвест»)',
    kind: 'dispute',
    branchId: 'branch-hq',
    counterparty: 'ООО «ГрандСтройИнвест»',
    accountingSubject: 'ooo_specialtech',
    status: 'dispute',
    createdAt: '2026-07-10',
    updatedAt: '2026-07-19',
    authorName: 'Воронова Е. В. (Юрист)',
    amountRub: 680000,
    disputeAmountRub: 81600,
    disputeReason: 'Отказ прораба подписывать 24 ч простоя при отсутствии ордера ОАТИ; приложены треки ГЛОНАСС и рапорт ЭСМ-7.',
    linkedOrderNumber: 'RO-MSK-26-011',
    inKnowledgeBase: true,
    content: `ДОСУДЕБНАЯ ПРЕТЕНЗИЯ № СПР-МСК-2026/003
(в порядке ч. 5 ст. 4 Арбитражного процессуального кодекса РФ)

Кому: Генеральному директору ООО «ГрандСтройИнвест» Морозову А. В. (вымышленное лицо)
Адрес: 117342, г. Москва, ул. Профсоюзная, д. 76, корп. 2, эт. 5 (вымышленный)
ИНН 7728887766 / КПП 772801001 / ОГРН 1177746554433

От: ООО «SpecialTech» (Арендодатель)
Адрес: 140090, Московская обл., г. Дзержинский, ул. Энергетиков, д. 14
ИНН 7700912345 / КПП 770001001

г. Москва                                                                  «10» июля 2026 г.

ПРЕТЕНЗИЯ
об оплате технологического простоя спецтехники по Договору № RO-MSK-26-011

Между ООО «SpecialTech» и ООО «ГрандСтройИнвест» заключён договор аренды спецтехники с экипажем (заказ-наряд № RO-MSK-26-011), во исполнение которого на объект Заказчика предоставлен исправный гусеничный экскаватор Komatsu PC210NLC-8 (инв. № EXC-14) с экипажем по ставке 3 400,00 ₽/машино-час (в т.ч. НДС 20%).

В период с 06.07.2026 по 08.07.2026 (три рабочие смены общей продолжительностью 24 машино-часа) Техника и машинист находились в полной эксплуатационной готовности на строительной площадке Заказчика, однако к выполнению земляных работ допущены не были по причине отсутствия у Заказчика оформленного ордера ОАТИ и закрытого доступа в зону раскопок.

На основании ст. 309, 310, 614 и п. 2 ст. 781 ГК РФ, а также п. 4.3 Договора технологический простой по обстоятельствам, зависящим от Заказчика, подлежит оплате в размере 100% базовой ставки аренды.

Расчёт задолженности:
24 машино-часа × 3 400,00 ₽ = 81 600 (Восемьдесят одна тысяча шестьсот) рублей 00 копеек, в т.ч. НДС 20% — 13 600,00 рублей.

Доказательная база (прилагается к настоящей претензии):
1. Выгрузка телеметрических данных системы ГЛОНАСС/GPS (подтверждение нахождения EXC-14 в геозоне объекта с 08:00 до 18:00 ежедневно).
2. Односторонние отметки в сменных рапортах ЭСМ-7 и акты фиксации простоя, подписанные машинистом и Fleet Manager участка.
3. Фотофиксация закрытого въезда и отсутствия допуска на площадку.

ТРЕБОВАНИЕ:
В течение 10 (десяти) календарных дней с момента получения настоящей претензии просим подписать УПД/акт сверки и перечислить задолженность за простой в сумме 81 600,00 ₽ на расчётный счёт ООО «SpecialTech».
В случае отказа или неполучения ответа в установленный срок ООО «SpecialTech» будет вынуждено обратиться в Арбитражный суд г. Москвы с отнесением на ООО «ГрандСтройИнвест» судебных расходов (ст. 110 АПК РФ), неустойки и процентов по ст. 395 ГК РФ.

Юрист ООО «SpecialTech» (по дов. № Ю-26/02) ___________________ / Воронова Е. В. /`
  },
  {
    id: 'leg-5',
    number: 'СПР-КЗН-2026/002',
    title: 'Претензия по просрочке оплаты КС-2 / УПД (> 14 дней, АО «КазаньПромИнвест»)',
    kind: 'claim',
    branchId: 'branch-kzn',
    counterparty: 'АО «КазаньПромИнвест»',
    accountingSubject: 'ooo_specialtech',
    status: 'dispute',
    createdAt: '2026-07-15',
    updatedAt: '2026-07-19',
    authorName: 'Воронова Е. В. (Юрист)',
    amountRub: 540000,
    disputeAmountRub: 185000,
    disputeReason: 'Просрочка оплаты по подписанным актам КС2-КЗН-044 и КС2-КЗН-045 свыше 14 календарных дней.',
    linkedOrderNumber: 'RO-KZN-26-005',
    inKnowledgeBase: false,
    content: `ДОСУДЕБНАЯ ПРЕТЕНЗИЯ № СПР-КЗН-2026/002
о погашении просроченной задолженности и уплате неустойки

Кому: Генеральному директору АО «КазаньПромИнвест» Садыкову Р. К. (вымышленное лицо)
Адрес: 420061, г. Казань, ул. Ершова, д. 31А, оф. 12 (вымышленный)
ИНН 1660776655 / КПП 166001001 / ОГРН 1141690112233

От: ООО «SpecialTech» (филиал «Поволжье»)
ИНН 7700912345 / КПП 165943001

г. Казань                                                                  «15» июля 2026 г.

По договору № RO-KZN-26-005 ООО «SpecialTech» надлежащим образом оказало АО «КазаньПромИнвест» услуги строительной спецтехники, что подтверждено подписанными без замечаний сменными рапортами ЭСМ-7 и актами / УПД № КС2-КЗН-044 от 25.06.2026 (95 000,00 ₽) и № КС2-КЗН-045 от 30.06.2026 (90 000,00 ₽).

Срок оплаты (5 банковских дней с даты подписания актов) истёк, однако на «15» июля 2026 г. оплата на расчётный счёт не поступила. Сумма просроченного основного долга составляет 185 000 (Сто восемьдесят пять тысяч) рублей 00 копеек.

На основании ст. 309, 310, 328, 330 ГК РФ и ч. 5 ст. 4 АПК РФ ТРЕБУЕМ:
1. В срок до «25» июля 2026 г. погасить основной долг в размере 185 000,00 ₽.
2. Уплатить договорную неустойку (0,1% в день) на дату фактической оплаты (на 15.07.2026 — 2 590,00 ₽ за 14 дней просрочки).

УВЕДОМЛЕНИЕ: В порядке ст. 328 ГК РФ при непоступлении оплаты до указанной даты подача спецтехники на объекты АО «КазаньПромИнвест» приостанавливается, а материалы передаются в Арбитражный суд Республики Татарстан.

Руководитель филиала «Поволжье» ___________________ / Волков И. А. /
Юрист (по дов. № Ю-26/02)        ___________________ / Воронова Е. В. /`
  },
  {
    id: 'leg-6',
    number: 'ДОГ-СУБ-МСК-2026/004',
    title: 'Договор субаренды (привлечения) техники частника с экипажем (ИП Громов Д. А.)',
    kind: 'contract',
    branchId: 'branch-hq',
    counterparty: 'ИП Громов Дмитрий Алексеевич (Частник)',
    accountingSubject: 'ooo_specialtech',
    status: 'active',
    createdAt: '2026-07-02',
    updatedAt: '2026-07-18',
    authorName: 'Воронова Е. В. (Юрист)',
    amountRub: 640000,
    inKnowledgeBase: true,
    content: `ДОГОВОР ПРИВЛЕЧЕНИЯ (СУБАРЕНДЫ) СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № ДОГ-СУБ-МСК-2026/004
(работа с частным владельцем / подрядчиком со своей техникой)

г. Москва                                                                  «02» июля 2026 г.

Индивидуальный предприниматель Громов Дмитрий Алексеевич (вымышленное лицо), действующий на основании записи в ЕГРИП ОГРНИП 321774600099112, именуемый в дальнейшем «Исполнитель (Владелец техники)», с одной стороны, и
Общество с ограниченной ответственностью «SpecialTech» (ООО «SpecialTech»), в лице Генерального директора Игнатова Виктора Петровича (вымышленное лицо), действующего на основании Устава, именуемое в дальнейшем «Заказчик (Арендатор)», с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА И ОСОБЫЙ СТАТУС СТОРОН
1.1. В соответствии со ст. 632–641 ГК РФ Исполнитель обязуется предоставить Заказчику принадлежащую Исполнителю на праве собственности/владения строительную спецтехнику (экскаватор-погрузчик JCB 3CX Super, госномер 7700 АЕ 77) с собственным экипажем (управлением силами Исполнителя), ГСМ, страховкой и ТО для выполнения работ на объектах третьих лиц (клиентов Заказчика).
1.2. Настоящий Договор носит гражданско-правовой характер между самостоятельными субъектами предпринимательской деятельности; Исполнитель не состоит в трудовых отношениях с Заказчиком, самостоятельно уплачивает налоги и страховые взносы и не обеспечивается корпоративными топливными картами Заказчика.

2. СТАВКА ПОДРЯДЧИКА И ПОРЯДОК РАСЧЁТОВ
2.1. Стоимость машино-часа привлечённой техники Исполнителя составляет 2 200,00 ₽/час (без НДС в связи с применением Исполнителем УСН, гл. 26.2 НК РФ). Минимальная смена — 8 м/ч.
2.2. Основанием для расчёта является подписанный на объекте сменный рапорт ЭСМ-7 / путевой лист с визой прораба конечного клиента, переданный диспетчеру Заказчика не позднее 24 часов после завершения смены.
2.3. Оплата услуг Исполнителя производится в течение 5 (пяти) банковских дней после подписания Акта оказанных услуг и поступления оплаты от конечного заказчика на счёт ООО «SpecialTech», но не позднее 20 (двадцати) календарных дней с даты закрытия отчётного периода.

3. ОТВЕТСТВЕННОСТЬ И КОНФИДЕНЦИАЛЬНОСТЬ (ЗАПРЕТ ОБХОДА)
3.1. Исполнитель несёт ответственность за исправность техники, наличие допусков, медосмотра водителя и вред, причинённый третьим лицам при управлении техникой (ст. 640 ГК РФ).
3.2. В период действия Договора и в течение 12 месяцев после его окончания Исполнитель обязуется не вступать в прямые договорные отношения с конечными заказчиками Заказчика, на объекты которых техника направлялась по настоящему Договору, без письменного согласия Заказчика (штраф за нарушение — 150 000 ₽ за каждый выявленный факт).

4. РЕКВИЗИТЫ СТОРОН (вымышленные)
Заказчик: ООО «SpecialTech», ИНН 7700912345 / КПП 770001001, р/с 40702810900000012345 в АО «Восточно-Столичный Банк».
Исполнитель: ИП Громов Д. А., ИНН 772400112233 / ОГРНИП 321774600099112, адрес: г. Москва, ул. Кантемировская, д. 16, корп. 1, кв. 45 (вымышленный), р/с 40802810500000088112 в АО «Столичный Банк».

Заказчик: ___________________ / Игнатов В. П. /      Исполнитель: ___________________ / ИП Громов Д. А. /`
  },
  {
    id: 'leg-tpl-1',
    number: 'ШАБ-АРЕНДА-2026',
    title: 'Шаблон: Полный договор аренды спецтехники с экипажем (Юр. лицо, ГК РФ гл. 34)',
    kind: 'template',
    branchId: 'branch-hq',
    counterparty: 'Типовой шаблон (ЮЛ)',
    accountingSubject: 'ooo_specialtech',
    status: 'active',
    createdAt: '2026-01-15',
    updatedAt: '2026-07-01',
    authorName: 'Юридический отдел',
    amountRub: 0,
    inKnowledgeBase: true,
    content: `ДОГОВОР АРЕНДЫ СТРОИТЕЛЬНОЙ СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № [НОМЕР ДОГОВОРА]

г. [ГОРОД]                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

Общество с ограниченной ответственностью «SpecialTech», именуемое в дальнейшем «Арендодатель», в лице [ДОЛЖНОСТЬ И ФИО ПОДПИСАНТА], действующего на основании [Устава / Доверенности № ...], с одной стороны, и
[ПОЛНОЕ НАИМЕНОВАНИЕ КОНТРАГЕНТА], именуемое в дальнейшем «Арендатор», в лице [ДОЛЖНОСТЬ И ФИО ПОДПИСАНТА], действующего на основании [Устава / Доверенности № ...], с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА (СТ. 632–641 ГК РФ)
1.1. Арендодатель обязуется предоставить Арендатору за плату во временное владение и пользование строительную технику (далее — «Техника») согласно Спецификации (Приложение № 1), а также оказывать своими силами услуги по управлению Техникой и её технической эксплуатации.
1.2. Адрес строительного объекта: [АДРЕС ОБЪЕКТА].
1.3. Передача Техники оформляется Актом приёма-передачи (форма № ОС-1 / акт допуска). Учёт наработки ведётся по сменным рапортам ЭСМ-7 (Постановление Госкомстата РФ № 78) и путевым листам (Приказ Минтранса РФ № 390).

2. ОБЯЗАННОСТИ СТОРОН И БЕЗОПАСНОСТЬ РАБОТ
2.1. Арендодатель обеспечивает Технику экипажем, ГСМ, текущим и капитальным ремонтом (ст. 634–636 ГК РФ), а также предрейсовым медосмотром водителя (ФЗ № 196-ФЗ «О безопасности дорожного движения»).
2.2. Арендатор обязан до начала работ подготовить площадку и подъездные пути, получить ордер/разрешение на земляные работы, передать схемы подземных коммуникаций, обеспечить объект ППРк и аттестованными стропальщиками при работе грузоподъёмных кранов (Приказ Ростехнадзора от 26.11.2020 № 461, Приказ Минтруда РФ № 883н), а также круглосуточную охрану Техники в нерабочее время.

3. РАБОЧЕЕ ВРЕМЯ, ПЕРЕГОН И ПРОСТОЙ
3.1. Минимальная смена — 8 (восемь) машино-часов. Начало дневной смены — 08:00. Переработка сверх 8 часов учитывается с шагом 30 минут.
3.2. Перебазировка тралом оплачивается по согласованному тарифу до выезда (ст. 328 ГК РФ). При совпадении начала смены и начала работ на объекте перегон равен 0 часов.
3.3. Технологический простой по вине Арендатора (отсутствие фронта работ, разрешений, стропальщиков, закрытый въезд) оплачивается по ставке 100% тарифа (ст. 614, п. 2 ст. 781 ГК РФ) и подтверждается актом либо данными ГЛОНАСС.

4. ЦЕНА, ЭДО И ПОРЯДОК РАСЧЁТОВ
4.1. Тариф составляет [СТАВКА] ₽/машино-час, в том числе НДС 20% (ст. 164 НК РФ).
4.2. Закрывающие документы (УПД / КС-2 / ЭСМ-7) направляются через ЭДО (ФЗ № 63-ФЗ) в течение 3 рабочих дней по окончании периода. Срок рассмотрения и подписания Арендатором — 5 рабочих дней; при отсутствии мотивированного отказа услуги считаются принятыми.
4.3. Срок оплаты — 5 (пять) банковских дней с даты выставления счёта. Положения ст. 317.1 и ст. 823 ГК РФ не применяются.

5. ОТВЕТСТВЕННОСТЬ И ЗАВЕРЕНИЯ (СТ. 330, 431.2, 640 ГК РФ, СТ. 54.1 НК РФ)
5.1. За просрочку оплаты — неустойка 0,1% за каждый день просрочки (ст. 330 ГК РФ). При просрочке более 10 календарных дней Арендодатель вправе приостановить работу Техники (ст. 328 ГК РФ).
5.2. Ответственность за вред третьим лицам регулируется ст. 640 ГК РФ (с правом регресса к Арендатору при нарушении ТБ на площадке).
5.3. Стороны гарантируют добросовестность и отражение сделок в налоговой отчётности (ст. 431.2 ГК РФ, ст. 54.1 НК РФ).

6. СПОРЫ И ФОРС-МАЖОР
6.1. Форс-мажор подтверждается ТПП РФ (п. 3 ст. 401 ГК РФ).
6.2. Досудебный претензионный порядок — 10 календарных дней (ч. 5 ст. 4 АПК РФ). Подсудность — Арбитражный суд по месту нахождения Истца (г. Москва / Республика Татарстан).

7. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (вымышленные / подлежащие заполнению)
Арендодатель: ООО «SpecialTech» · ИНН 7700912345 / КПП 770001001 / ОГРН 1207700999881
Р/с 40702810900000012345 в АО «Восточно-Столичный Банк», БИК 044525999
Подпись: ___________________ / [ФИО] / (М.П.)

Арендатор: [НАИМЕНОВАНИЕ КОНТРАГЕНТА] · ИНН [ИНН] / КПП [КПП] / ОГРН [ОГРН]
Р/с [Р/С] в [НАИМЕНОВАНИЕ БАНКА], БИК [БИК]
Подпись: ___________________ / [ФИО] / (М.П.)`
  },
  {
    id: 'leg-tpl-2',
    number: 'ШАБ-ПРЕТЕНЗИЯ-2026',
    title: 'Шаблон: Досудебная претензия о взыскании долга, простоя и неустойки (ст. 4 АПК РФ)',
    kind: 'template',
    branchId: 'branch-hq',
    counterparty: 'Типовой шаблон (Претензия)',
    accountingSubject: 'ooo_specialtech',
    status: 'active',
    createdAt: '2026-02-10',
    updatedAt: '2026-07-05',
    authorName: 'Юридический отдел',
    amountRub: 0,
    inKnowledgeBase: true,
    content: `ДОСУДЕБНАЯ ПРЕТЕНЗИЯ № [НОМЕР]
(направляется в порядке обязательного досудебного урегулирования спора — ч. 5 ст. 4 АПК РФ)

Кому: [ДОЛЖНОСТЬ И ФИО РУКОВОДИТЕЛЯ] [НАИМЕНОВАНИЕ КОНТРАГЕНТА]
Адрес: [ЮРИДИЧЕСКИЙ АДРЕС КОНТРАГЕНТА]
ИНН [ИНН] / ОГРН [ОГРН]

От: ООО «SpecialTech» (ИНН 7700912345 / ОГРН 1207700999881)
Адрес: 140090, Московская обл., г. Дзержинский, ул. Энергетиков, д. 14

Дата: «[ДД]» [МЕСЯЦ] 2026 г.

ПРЕТЕНЗИЯ
по Договору аренды спецтехники с экипажем № [НОМЕР ДОГОВОРА] от [ДАТА ДОГОВОРА]

1. Обстоятельства дела:
ООО «SpecialTech» надлежащим образом исполнило обязательства по предоставлению спецтехники [МАРКА, ИНВ. №] на объект [АДРЕС ОБЪЕКТА], что подтверждается сменными рапортами ЭСМ-7 / путевыми листами № [НОМЕРА], УПД/актами КС-2 № [НОМЕРА] и данными телеметрии ГЛОНАСС.
2. Нарушение обязательств:
В нарушение ст. 309, 310, 614, 781 ГК РФ и условий Договора Арендатор не произвёл оплату оказанных услуг (и/или времени технологического простоя по вине Арендатора) в установленный срок.
3. Расчёт требований:
- Основной долг по актам / простоям: [СУММА ОСНОВНОГО ДОЛГА] ₽;
- Договорная неустойка (0,1% за каждый день просрочки, ст. 330 ГК РФ) за период с [ДАТА] по [ДАТА] ([ДНИ] дн.): [СУММА ПЕНИ] ₽;
ИТОГО к уплате: [ОБЩАЯ СУММА] ₽.

На основании изложенного ТРЕБУЕМ в течение 10 (десяти) календарных дней с даты направления настоящей претензии погасить указанную задолженность путём перечисления на р/с 40702810900000012345 в АО «Восточно-Столичный Банк», БИК 044525999.
При неудовлетворении требований в добровольном порядке спор будет передан в Арбитражный суд с взысканием судебных расходов (ст. 110 АПК РФ) и процентов по ст. 395 ГК РФ.

Приложения: 1. Копия договора и спецификации. 2. Реестр ЭСМ-7 / ПЛ и УПД. 3. Отчёт ГЛОНАСС.

Представитель по доверенности ___________________ / [ФИО] /`
  },
  {
    id: 'leg-tpl-3',
    number: 'ШАБ-ФИЗЛИЦО-2026',
    title: 'Шаблон: Договор-заявка на услуги спецтехники с физ. лицом (ИП, УСН без НДС)',
    kind: 'template',
    branchId: 'branch-hq',
    counterparty: 'Типовой шаблон (ФЛ / ИП)',
    accountingSubject: 'ip_specialtechnica',
    status: 'active',
    createdAt: '2026-03-01',
    updatedAt: '2026-07-05',
    authorName: 'Юридический отдел',
    amountRub: 0,
    inKnowledgeBase: true,
    content: `ДОГОВОР-ЗАЯВКА НА ОКАЗАНИЕ УСЛУГ СПЕЦТЕХНИКОЙ № [НОМЕР]
(для Заказчиков — физических лиц, гл. 39 ГК РФ, Закон РФ от 07.02.1992 № 2300-1)

г. [ГОРОД]                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

Индивидуальный предприниматель «SpecialTechnica» (вымышленное наименование ИП Соколовский Антон Владимирович, ОГРНИП 322508100077889, ИНН 502700889911), применяющий упрощённую систему налогообложения (УСН, без НДС в соответствии с гл. 26.2 / ст. 145 НК РФ), именуемый в дальнейшем «Исполнитель», с одной стороны, и
Гражданин(ка) РФ [ФИО ЗАКАЗЧИКА ПОЛНОСТЬЮ], паспорт серия [ХХХХ] № [ХХХХХХ], выдан [ОРГАН И ДАТА ВЫДАЧИ], зарегистрированный(ая) по адресу: [АДРЕС РЕГИСТРАЦИИ], тел. [ТЕЛЕФОН], именуемый(ая) в дальнейшем «Заказчик», с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА (СТ. 779 ГК РФ)
1.1. Исполнитель обязуется по заявке Заказчика оказать услуги строительной спецтехникой [МАРКА И ТИП ТЕХНИКИ] с экипажем и ГСМ на земельном участке Заказчика по адресу: [АДРЕС ОБЪЕКТА], а Заказчик обязуется принять и оплатить оказанные услуги.
1.2. Настоящий Договор не является договором строительного подряда: Исполнитель выполняет технологические операции по указанию Заказчика на объекте (планировка, копка, погрузка) без принятия рисков проектных решений и скрытых инженерных сетей.

2. УСЛОВИЯ НА УЧАСТКЕ И БЕЗОПАСНОСТЬ
2.1. Заказчик гарантирует наличие свободного подъезда шириной не менее 3,5 м, твёрдого грунта и отсутствие посторонних лиц (включая детей и животных) в радиусе опасной зоны работы стрелы/ковша.
2.2. Заказчик обязан до начала земляных работ указать на местности точное прохождение частных и магистральных коммуникаций (электрокабель, газ, водопровод, септик). При непредоставлении сведений ответственность за повреждение скрытых коммуникаций несёт Заказчик.

3. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ (ФЗ № 54-ФЗ)
3.1. Минимальный заказ составляет [8] машино-часов по ставке [СТАВКА] ₽/час. Итого стоимость минимальной смены: [СУММА] ₽ (НДС не облагается, УСН).
3.2. Подача/перебазировка техники на участок составляет [СУММА ПОДАЧИ] ₽.
3.3. Оплата производится Заказчиком до начала работы (предоплата минимальной смены и подачи) либо по факту окончания смены наличными / по СБП / на расчётный счёт Исполнителя с обязательной выдачей кассового чека (ФЗ от 22.05.2003 № 54-ФЗ) и подписанием Акта (путевого листа).

4. СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ (ФЗ № 152-ФЗ)
4.1. Подписывая настоящий Договор, Заказчик в соответствии со ст. 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» даёт согласие Исполнителю на обработку своих персональных данных (ФИО, телефон, паспортные данные, адрес объекта) исключительно в целях исполнения настоящего Договора и оформления закрывающих документов.

5. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (вымышленные)
Исполнитель: ИП «SpecialTechnica» (ИП Соколовский А. В.)
ИНН 502700889911 / ОГРНИП 322508100077889
Р/с 40802810200000044556 в АО «Восточно-Столичный Банк», БИК 044525999
Подпись: ___________________ / ИП Соколовский А. В. /

Заказчик (Физ. лицо): [ФИО ЗАКАЗЧИКА]
Паспорт: [СЕРИЯ И НОМЕР] · Тел.: [ТЕЛЕФОН]
Подпись: ___________________ / [ФИО] /`
  },
  {
    id: 'leg-tpl-4',
    number: 'ШАБ-СУБАРЕНДА-ЧАСТНИК-2026',
    title: 'Шаблон: Договор субаренды (привлечения) техники частника (ИП / Самозанятый НПД)',
    kind: 'template',
    branchId: 'branch-hq',
    counterparty: 'Типовой шаблон (Частник / Субаренда)',
    accountingSubject: 'ooo_specialtech',
    status: 'active',
    createdAt: '2026-07-05',
    updatedAt: '2026-07-18',
    authorName: 'Юридический отдел',
    amountRub: 0,
    inKnowledgeBase: true,
    content: `ДОГОВОР ПРИВЛЕЧЕНИЯ (СУБАРЕНДЫ) СПЕЦТЕХНИКИ С ЭКИПАЖЕМ № [НОМЕР]
(привлечение частного владельца со своей техникой — ИП или плательщика НПД по ФЗ № 422-ФЗ)

г. [ГОРОД]                                                                  «[ДД]» [МЕСЯЦ] 2026 г.

[ИП ФИО / Гражданин РФ ФИО, плательщик налога на профессиональный доход (самозанятый) по ФЗ от 27.11.2018 № 422-ФЗ], именуемый в дальнейшем «Исполнитель (Владелец техники)», с одной стороны, и
ООО «SpecialTech» (ИНН 7700912345), именуемое в дальнейшем «Заказчик», с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Исполнитель предоставляет Заказчику собственную (или законно арендуемую) строительную технику [МАРКА, ГОСНОМЕР] с управлением и техническим обслуживанием своими силами (ст. 632–641 ГК РФ) для работы на объектах клиентов Заказчика.
1.2. Договор регулируется исключительно гражданским законодательством РФ. Стороны не состоят в трудовых отношениях; Исполнитель самостоятельно определяет режим своего отдыха, несёт расходы по ГСМ, ремонту и страхованию своей техники.

2. СТАВКА И ПОРЯДОК ВЫПЛАТЫ
2.1. Закупочная ставка для Исполнителя составляет [СТАВКА ПОДРЯДЧИКА] ₽/машино-час (без НДС).
2.2. Сменные рапорты ЭСМ-7 с подписью представителя объекта передаются диспетчеру Заказчика в течение 24 часов после смены.
2.3. Выплата вознаграждения производится в течение [5] банковских дней после подписания сводного Акта за месяц/период и поступления оплаты от конечного клиента (либо не позднее [20] календарных дней).
2.4. Если Исполнитель применяет специальный налоговый режим НПД (ФЗ № 422-ФЗ), Исполнитель обязан в момент получения оплаты сформировать и передать Заказчику чек в приложении «Мой налог» (ч. 1 ст. 14 ФЗ № 422-ФЗ), а при утрате статуса плательщика НПД — уведомить Заказчика в течение 3 рабочих дней под угрозой возмещения налоговых потерь (ст. 406.1 ГК РФ).

3. ОТВЕТСТВЕННОСТЬ И НЕПЕРЕМАНИВАНИЕ
3.1. Ответственность перед третьими лицами регулируется ст. 640 ГК РФ.
3.2. Запрет прямых сделок с объектами и клиентами Заказчика в течение 12 месяцев (штраф [150 000] ₽).

4. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (вымышленные / для заполнения)
Заказчик: ООО «SpecialTech», ИНН 7700912345 / КПП 770001001, р/с 40702810900000012345
Исполнитель (Частник): [ФИО / ИП], ИНН [ИНН], паспорт/ОГРНИП [ДАННЫЕ], р/с или карта [РЕКВИЗИТЫ]

Заказчик: ___________________ / [ФИО] /       Исполнитель: ___________________ / [ФИО] /`
  }
];

export const initialLegalHistory: LegalHistoryEntry[] = [
  {
    id: 'lh-1',
    documentId: 'leg-4',
    documentNumber: 'СПР-МСК-2026/003',
    documentTitle: 'Спор по актированию 24 часов простоя экскаватора Komatsu PC210 (EXC-14)',
    action: 'dispute_opened',
    actorRole: 'lawyer',
    actorName: 'Воронова Е. В.',
    timestamp: '2026-07-19 10:15',
    details: 'Сформирована досудебная претензия на 81 600 ₽, приложены треки ГЛОНАСС и ЭСМ-7.'
  },
  {
    id: 'lh-2',
    documentId: 'leg-3',
    documentNumber: 'ДС-МСК-2026/014-1',
    documentTitle: 'Дополнительное соглашение о продлении смен и пересмотре тарифа перегона',
    action: 'created',
    actorRole: 'lawyer',
    actorName: 'Воронова Е. В.',
    timestamp: '2026-07-18 16:40',
    details: 'Документ создан на участке MSK и направлен на согласование Top Manager.'
  },
  {
    id: 'lh-3',
    documentId: 'leg-2',
    documentNumber: 'ДОГ-КЗН-2026/009',
    documentTitle: 'Договор аренды автокранов и самосвалов на трассе М-12 (ООО «ТатСтройМост»)',
    action: 'saved_to_base',
    actorRole: 'admin',
    actorName: 'Администратор системы',
    timestamp: '2026-07-16 12:20',
    details: 'Договор сохранён в полную базу документов и синхронизирован с 1С.'
  },
  {
    id: 'lh-4',
    documentId: 'leg-1',
    documentNumber: 'ДОГ-МСК-2026/014',
    documentTitle: 'Договор аренды спецтехники с экипажем №14 (ООО «Монолит-Строй»)',
    action: 'exported',
    actorRole: 'accountant',
    actorName: 'Главный бухгалтер',
    timestamp: '2026-07-15 09:30',
    details: 'Выгрузка скан-копии и карточки договора для сверки расчётов (режим просмотра).'
  }
];




