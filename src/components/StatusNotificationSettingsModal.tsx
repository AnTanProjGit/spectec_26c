import React, { useState } from 'react';
import {
  X,
  Bell,
  CheckCircle,
  MessageSquare,
  Sliders,
  Receipt,
  FileCheck,
  CheckCheck
} from 'lucide-react';
import { StatusNotificationItem, StatusNotificationSettings } from '../types';

interface StatusNotificationSettingsModalProps {
  isOpen: boolean;
  settings: StatusNotificationSettings;
  notifications: StatusNotificationItem[];
  onClose: () => void;
  onUpdateSettings: (next: StatusNotificationSettings) => void;
  onMarkAllRead: () => void;
}

export const StatusNotificationSettingsModal: React.FC<
  StatusNotificationSettingsModalProps
> = ({
  isOpen,
  settings,
  notifications,
  onClose,
  onUpdateSettings,
  onMarkAllRead
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'settings'>('settings');

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleField = (key: keyof Omit<StatusNotificationSettings, 'remindDebtOverdueDays'>) => {
    onUpdateSettings({
      ...settings,
      [key]: !settings[key]
    });
  };

  const categoryBadge = (cat: StatusNotificationItem['category']) => {
    if (cat === 'act_ks2') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
          Акт / КС-2
        </span>
      );
    }
    if (cat === 'invoice') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
          Счёт на оплату
        </span>
      );
    }
    if (cat === 'payment_status') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
          Статус оплаты
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
        Закрытие смены
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                Уведомления о статусе документов и оплаты
              </h2>
              <p className="text-xs text-slate-400">
                События по закрытию объёма (Акт / КС-2), выставлению счёта и оплате
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'settings'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Правила уведомлений</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'feed'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Журнал ({notifications.length})</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[10px] font-mono">
                  +{unreadCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'feed' && unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Отметить прочитанными</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'settings' ? (
            <>
              {/* Master Switch */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    Включить автоматические уведомления о статусах
                  </div>
                  <div className="text-xs text-slate-400">
                    Формирует уведомление в ERP и выбранные каналы при смене статуса документов
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleField('enabled')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition border ${
                    settings.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {settings.enabled ? 'Включено' : 'Отключено'}
                </button>
              </div>

              {/* Event Triggers */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>События документооборота и расчётов</span>
                </div>

                {[
                  {
                    key: 'onVolumeCloseActKs2' as const,
                    label: 'Закрытие объёма работ (создание Акта и КС-2)',
                    desc: 'Уведомлять при формировании и сохранении Акта / КС-2 в базу'
                  },
                  {
                    key: 'onActSignedChange' as const,
                    label: 'Подписание или отзыв Акта заказчиком',
                    desc: 'Фиксировать смену статуса подписи Акта в аренде и CRM'
                  },
                  {
                    key: 'onInvoiceIssued' as const,
                    label: 'Выставление счёта на оплату услуг',
                    desc: 'Уведомлять при формировании счёта с реквизитами ООО/ИП'
                  },
                  {
                    key: 'onInvoiceStatusChange' as const,
                    label: 'Изменение статуса оплаты счёта',
                    desc: 'Частичная оплата, полная оплата или просрочка платежа'
                  }
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50 cursor-pointer hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      disabled={!settings.enabled}
                      onChange={() => toggleField(item.key)}
                      className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              {/* Delivery Channels */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>Каналы доставки уведомлений</span>
                </div>

                <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50 cursor-pointer hover:border-slate-700 transition">
                  <div>
                    <div className="text-xs font-bold text-white">
                      Дублировать статус в Корпоративный чат участка
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Автоматическое системное сообщение с номером Акта / КС-2 / Счёта и суммой
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sendToBranchChat}
                    disabled={!settings.enabled}
                    onChange={() => toggleField('sendToBranchChat')}
                    className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50 cursor-pointer hover:border-slate-700 transition">
                  <div>
                    <div className="text-xs font-bold text-white">
                      Отправлять уведомление контрагенту в клиент-бот MAX
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Оповещает клиента о готовности КС-2 и выставлении счёта на оплату
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sendToMaxClientBot}
                    disabled={!settings.enabled}
                    onChange={() => toggleField('sendToMaxClientBot')}
                    className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/50">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-rose-400" />
                      <span>Контроль просрочки оплаты счёта</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Через сколько банковских дней напоминать о неоплаченном счёте
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.remindDebtOverdueDays}
                      onChange={e =>
                        onUpdateSettings({
                          ...settings,
                          remindDebtOverdueDays: Math.max(1, Number(e.target.value) || 5)
                        })
                      }
                      className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs text-right"
                    />
                    <span className="text-xs text-slate-400">дн.</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Пока нет зафиксированных уведомлений. Закройте объём (Акт / КС-2) или
                  выставьте счёт на странице «Аренда и объекты» либо «CRM участка».
                </div>
              ) : (
                notifications.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition ${
                      item.read
                        ? 'bg-slate-950/40 border-slate-800/80'
                        : 'bg-slate-950 border-amber-500/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {categoryBadge(item.category)}
                        <span className="text-xs font-bold text-white">{item.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                      <span className="font-mono text-amber-300">{item.entityLabel}</span>
                      <span>·</span>
                      <span>Каналы: {item.channels.join(', ')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Настройки применяются для «Аренда и объекты» и «CRM участка»</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
