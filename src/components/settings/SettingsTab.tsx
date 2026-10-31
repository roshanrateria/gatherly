import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Cpu,
  Key,
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Check,
  Info,
  DollarSign,
} from 'lucide-react';
import { AppState, AIConfig, AIProviderType } from '../../types/index';
import { CurrencyCode, CURRENCY_CONFIGS } from '../../types/currency';
import { exportStateToJson, validateAndImportState, clearAllStoredData } from '../../lib/storage';
import { createSampleWedding, createSampleBirthday, createSampleCorporate } from '../../lib/sampleEvents';

interface SettingsTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { aiConfig, event } = state;

  const [provider, setProvider] = useState<AIProviderType>(aiConfig.provider || 'offline');
  const [apiKey, setApiKey] = useState(aiConfig.apiKey || '');
  const [model, setModel] = useState(aiConfig.model || 'gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [discloseConsent, setDiscloseConsent] = useState(aiConfig.discloseDataSharing || false);

  const [currency, setCurrency] = useState<CurrencyCode>(event.budget.currency || 'INR');
  const [numberFormat, setNumberFormat] = useState<'lakhs' | 'international'>(
    event.budget.numberFormat || 'lakhs'
  );

  const handleSaveAiConfig = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedConfig: AIConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      baseUrl: baseUrl.trim() || undefined,
      discloseDataSharing: discloseConsent,
    };

    onUpdateState({ ...state, aiConfig: updatedConfig });
    onShowToast(
      'success',
      'AI Configuration Saved',
      provider === 'offline'
        ? 'Offline Mode Active (High-Precision Deterministic Engine)'
        : `Connected to ${provider.toUpperCase()} (${model})`
    );
  };

  const handleSaveRegional = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateState({
      ...state,
      event: {
        ...event,
        budget: {
          ...event.budget,
          currency,
          numberFormat,
        },
      },
    });
    onShowToast('success', 'Regional Preferences Updated', `Currency set to ${currency}`);
  };

  const handleExportBackup = () => {
    exportStateToJson(state);
    onShowToast('success', 'Master Backup Downloaded', 'Contains all events, tasks, and budgets.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = validateAndImportState(content);
      if (result.success && result.state) {
        onUpdateState(result.state);
        onShowToast('success', 'Backup Restored Successfully', result.state.event.title);
      } else {
        onShowToast('error', 'Import Failed', result.error || 'Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetPreset = (preset: 'wedding' | 'corporate' | 'birthday') => {
    if (confirm(`Load sample ${preset} event? Current unsaved modifications will be replaced.`)) {
      let sample: AppState;
      if (preset === 'wedding') sample = createSampleWedding();
      else if (preset === 'corporate') sample = createSampleCorporate();
      else sample = createSampleBirthday();

      onUpdateState(sample);
      onShowToast('info', 'Loaded Sample Preset', sample.event.title);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-bold font-editorial text-slate-900">
          Settings &amp; Infrastructure
        </h2>
        <p className="text-xs text-slate-500">
          AI engine management, currency/number formatting, and local-first data backup
        </p>
      </div>

      {/* AI Provider Section */}
      <form
        onSubmit={handleSaveAiConfig}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-900 text-amber-300 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-editorial">
                AI Engine &amp; Provider Routing
              </h3>
              <p className="text-xs text-slate-500">
                Choose between zero-key Offline Deterministic Expert Mode or live LLM integration
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              provider === 'offline'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-purple-100 text-purple-900'
            }`}
          >
            {provider === 'offline' ? 'Offline Mode Active' : `${provider.toUpperCase()} Mode`}
          </span>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setProvider('offline');
              setModel('offline-deterministic');
            }}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              provider === 'offline'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/10'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Offline Expert System
              </span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-emerald-200 text-emerald-950 uppercase">
                Zero Setup
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              100% deterministic rules, mathematical trade-offs, milestone schedules and overrun
              detection. Completely private, free, and works without an API key or internet connection.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setProvider('openai');
              setModel('gpt-4o-mini');
            }}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              provider !== 'offline'
                ? 'border-purple-900 bg-purple-50/50 ring-2 ring-purple-900/10'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-700" />
                Live LLM Provider (BYOK)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-purple-200 text-purple-950 uppercase">
                Custom API
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Connect OpenAI, Anthropic Claude, Google Gemini, or Groq using your own API key.
              Enables rich conversational creativity and multi-turn planning.
            </p>
          </button>
        </div>

        {/* Live LLM Configuration Inputs if not offline */}
        {provider !== 'offline' && (
          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-4 text-xs animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const p = e.target.value as AIProviderType;
                    setProvider(p);
                    if (p === 'openai') setModel('gpt-4o-mini');
                    else if (p === 'anthropic') setModel('claude-3-5-sonnet-20241022');
                    else if (p === 'gemini') setModel('gemini-1.5-flash');
                    else if (p === 'groq') setModel('llama-3.3-70b-versatile');
                  }}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
                  <option value="groq">Groq (Llama 3.3 70B)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                API Key (Stored locally in browser localStorage, never sent to external servers)
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full text-xs p-2.5 pr-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Base URL (Optional, for proxies or enterprise gateways)
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1/chat/completions"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
              />
            </div>

            {/* Mandatory External Data Disclosure Requirement */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>External AI Data Sharing Disclosure</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-700">
                When using live AI mode, your event brief, budget estimates, and guest count will be
                transmitted to the selected AI provider ({provider.toUpperCase()}) to generate
                customized recommendations. No personal payment credentials or server secrets are
                transmitted.
              </p>
              <label className="flex items-center gap-2 font-medium text-slate-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  required
                  checked={discloseConsent}
                  onChange={(e) => setDiscloseConsent(e.target.checked)}
                  className="rounded text-purple-900 focus:ring-purple-700"
                />
                <span>I understand and consent to external data transmission for AI planning</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-purple-900 hover:bg-purple-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Save AI Settings
          </button>
        </div>
      </form>

      {/* Currency & Regional Preferences */}
      <form
        onSubmit={handleSaveRegional}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-editorial">
              Currency &amp; Regional Formatting
            </h3>
            <p className="text-xs text-slate-500">
              Default to INR / Indian context, or switch freely to USD, EUR, GBP, AED without
              assumptions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Active Currency
            </label>
            <select
              value={currency}
              onChange={(e) => {
                const c = e.target.value as CurrencyCode;
                setCurrency(c);
                setNumberFormat(c === 'INR' ? 'lakhs' : 'international');
              }}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
            >
              {Object.values(CURRENCY_CONFIGS).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol}) — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Number Notation Format
            </label>
            <select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value as any)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
            >
              <option value="lakhs">Indian System (e.g. ₹45.00 L, ₹1.50 Cr)</option>
              <option value="international">International Standard (e.g. $4,500,000)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Update Regional Preferences
          </button>
        </div>
      </form>

      {/* Data Backup & Restore */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-editorial">
              Data Persistence, Backup &amp; Migration
            </h3>
            <p className="text-xs text-slate-500">
              Download complete event backup JSON, restore an existing workspace, or reset to
              standard benchmarks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-purple-900 hover:bg-purple-950 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Export Complete Backup (.JSON)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4 text-purple-700" />
            <span>Restore from Backup File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Reset to Pre-built Sample Events */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Reset to Sample Events
          </span>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => handleResetPreset('wedding')}
              className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-slate-200 hover:border-purple-300 text-slate-800 font-medium transition-colors"
            >
              Udaipur Royal Wedding (3-Day, ₹45 L)
            </button>
            <button
              onClick={() => handleResetPreset('corporate')}
              className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-slate-200 hover:border-purple-300 text-slate-800 font-medium transition-colors"
            >
              Tech Leadership Summit (350 Pax, ₹30 L)
            </button>
            <button
              onClick={() => handleResetPreset('birthday')}
              className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-slate-200 hover:border-purple-300 text-slate-800 font-medium transition-colors"
            >
              Milestone 40th Birthday (75 Pax, ₹5 L)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
