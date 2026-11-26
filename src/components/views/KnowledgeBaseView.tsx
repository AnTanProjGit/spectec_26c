import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Sparkles,
  ExternalLink,
  BookTemplate
} from 'lucide-react';
import { KnowledgeDoc } from '../../types';

interface KnowledgeBaseViewProps {
  docs: KnowledgeDoc[];
  onOpenAiWithContext?: (query: string) => void;
  onOpenContractsTemplates?: (docCode?: string) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  docs,
  onOpenAiWithContext,
  onOpenContractsTemplates
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeDoc, setActiveDoc] = useState<KnowledgeDoc | undefined>(docs[0]);

  const templatesCount = docs.filter(d => d.category === 'templates').length;

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fullText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-[14px] uppercase font-mono text-amber-400 font-semibold tracking-wider">
              RAG + FAISS Корпоративная база знаний
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            База знаний
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            Единый источник регламентов компании: нормы списания топлива, ставки оплаты машинистов, регламенты ТО, договоры и шаблоны
          </p>
        </div>

        {onOpenContractsTemplates && (
          <button
            type="button"
            onClick={() => onOpenContractsTemplates()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookTemplate className="w-4 h-4 text-amber-400" />
            <span>Шаблоны договоров и претензий ({templatesCount}) — открыть в «Договора»</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Семантический поиск по нормам ГСМ, регламентам ТО, договорам аренды, шаблонам и положениям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-[14px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Все документы' },
              { id: 'fuel_norms', label: 'Нормы ГСМ' },
              { id: 'regulations', label: 'Регламенты аренды' },
              { id: 'payroll', label: 'Оплата труда' },
              { id: 'maintenance', label: 'Техобслуживание' },
              { id: 'contracts', label: 'Договора' },
              { id: 'templates', label: `Шаблоны (${templatesCount})` },
              { id: 'disputes', label: 'Споры' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedCategory(tab.id);
                  const nextMatching = docs.find(d => tab.id === 'all' || d.category === tab.id);
                  if (nextMatching) setActiveDoc(nextMatching);
                }}
                className={`px-3 py-1 rounded-lg text-[14px] font-medium transition cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : tab.id === 'templates'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onOpenContractsTemplates && (
            <button
              type="button"
              onClick={() => onOpenContractsTemplates()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
            >
              <span>Перейти к шаблонам в разделе «Договора»</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Split: Document list + Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-[4fr_11fr] gap-2">
        {/* Left: Document List */}
        <div className="space-y-1.5">
          {filteredDocs.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-[13px] text-slate-400">
              Документы по заданному фильтру не найдены
            </div>
          ) : filteredDocs.map(doc => {
            const isSelected = activeDoc?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setActiveDoc(doc)}
                className={`p-3 rounded-xl border transition cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-amber-400 font-bold">{doc.code}</span>
                  <span className="text-slate-500 font-mono">{doc.dateUpdated}</span>
                </div>

                <h3 className="text-xs font-bold text-white leading-snug">
                  {doc.title}
                </h3>

                <p className="text-[13px] text-slate-400 line-clamp-2 leading-relaxed">
                  {doc.excerpt}
                </p>

                <div className="flex flex-wrap gap-1 pt-1">
                  {doc.tags.map(t => (
                    <span key={t} className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Full Document Reader */}
        {activeDoc && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-2.5 shadow-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[14px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      {activeDoc.code}
                    </span>
                    <span className="text-[14px] text-slate-400 font-mono">
                      Актуально на: {activeDoc.dateUpdated}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight mt-1">
                    {activeDoc.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onOpenContractsTemplates && (activeDoc.category === 'templates' || activeDoc.category === 'contracts') && (
                    <button
                      type="button"
                      onClick={() => onOpenContractsTemplates(activeDoc.category === 'templates' ? activeDoc.code : undefined)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-[13px] transition cursor-pointer"
                    >
                      <BookTemplate className="w-3.5 h-3.5" />
                      <span>Открыть в «Договора → Шаблоны»</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onOpenAiWithContext && (
                    <button
                      onClick={() => onOpenAiWithContext(`Проанализируй соответствие смен регламенту "${activeDoc.title}"`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[14px] transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Сверить с AI</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Document Text viewer */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 max-h-[540px] overflow-y-auto">
                <pre className="font-sans text-[14px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {activeDoc.fullText}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[14px] text-slate-400 flex items-center justify-between">
              <span>Документ проиндексирован векторной базой FAISS для RAG-поиска</span>
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Векторный индекс синхронизирован
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
