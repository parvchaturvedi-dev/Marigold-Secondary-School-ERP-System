import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Plug,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

const initialConfig = {
  phoneNumberId: '',
  businessAccountId: '',
  apiVersion: 'v23.0',
  accessToken: '',
};

const WhatsappIntegration = () => {
  const [config, setConfig] = useState(initialConfig);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    let active = true;
    apiFetch('/whatsapp-integration/config')
      .then((result) => {
        if (!active) return;
        setConfig({
          phoneNumberId: result.phoneNumberId || '',
          businessAccountId: result.businessAccountId || '',
          apiVersion: result.apiVersion || 'v23.0',
          accessToken: '',
        });
        setIsConfigured(Boolean(result.configured));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'WhatsApp settings could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateField = (field) => (event) => {
    setConfig((current) => ({ ...current, [field]: event.target.value }));
    setConnection(null);
    setNotice('');
    setError('');
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setNotice('');
    setConnection(null);
    try {
      const saved = await apiFetch('/whatsapp-integration/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setIsConfigured(true);
      setConfig((current) => ({ ...current, accessToken: '' }));
      setNotice('WhatsApp API settings saved securely.');
      setConfig((current) => ({
        ...current,
        phoneNumberId: saved.phoneNumberId,
        businessAccountId: saved.businessAccountId,
        apiVersion: saved.apiVersion,
      }));
    } catch (saveError) {
      setError(saveError.message || 'WhatsApp settings could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setError('');
    setNotice('');
    setConnection(null);
    try {
      const result = await apiFetch('/whatsapp-integration/test', { method: 'POST' });
      setConnection(result);
    } catch (testError) {
      setError(testError.message || 'WhatsApp connection test failed.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <main className="min-h-screen flex-1 p-4 text-slate-900 sm:p-6">
      <section className="glass-card mb-6 rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">WhatsApp Integration</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Connect the school&apos;s Meta WhatsApp Cloud API account. API credentials are encrypted
              by the backend and are never sent back to this page.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {isLoading ? 'Checking setup…' : isConfigured ? 'Settings saved' : 'Not connected'}
          </span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <form onSubmit={saveConfig} className="glass-card space-y-5 rounded-3xl p-5 sm:p-7">
          <div>
            <h2 className="text-lg font-extrabold">Meta Cloud API credentials</h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter the values from your Meta developer app and WhatsApp business account.
            </p>
          </div>

          {error && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {connection && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4" /> WhatsApp API connection successful
              </p>
              <p className="mt-1">{connection.verifiedName || 'WhatsApp Business'}{connection.displayPhoneNumber ? ` · ${connection.displayPhoneNumber}` : ''}</p>
            </div>
          )}

          <label className="block space-y-1.5 text-sm font-bold">
            WhatsApp Phone Number ID
            <input
              required
              inputMode="numeric"
              autoComplete="off"
              value={config.phoneNumberId}
              onChange={updateField('phoneNumberId')}
              placeholder="For example, 123456789012345"
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-bold">
            WhatsApp Business Account ID <span className="font-medium text-slate-400">(optional)</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={config.businessAccountId}
              onChange={updateField('businessAccountId')}
              placeholder="For example, 123456789012345"
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-bold">
            Meta Graph API version
            <input
              required
              autoComplete="off"
              value={config.apiVersion}
              onChange={updateField('apiVersion')}
              placeholder="v23.0"
              pattern="v[0-9]{1,3}\.[0-9]{1,2}"
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-bold">
            Permanent access token
            <span className="relative block">
              <input
                required={!isConfigured}
                type={showToken ? 'text' : 'password'}
                autoComplete="new-password"
                value={config.accessToken}
                onChange={updateField('accessToken')}
                placeholder={isConfigured ? 'Saved securely — leave blank to keep current token' : 'Paste the Meta system-user access token'}
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 pr-12 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={() => setShowToken((visible) => !visible)}
                aria-label={showToken ? 'Hide access token' : 'Show access token'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving securely…' : 'Save API settings'}
            </button>
            <button
              type="button"
              onClick={testConnection}
              disabled={!isConfigured || isTesting || isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {isTesting ? 'Testing connection…' : 'Test connection'}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="glass-card rounded-3xl p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 font-extrabold">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              Credential security
            </div>
            <ul className="space-y-3 text-sm leading-6 text-slate-600">
              <li>Access tokens are encrypted with AES-256-GCM before being stored in PostgreSQL.</li>
              <li>The token is never returned by the API or saved in browser storage.</li>
              <li>Only admin accounts can read or update these integration settings.</li>
              <li>WhatsApp API requests are made by the backend over HTTPS, not directly from the browser.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            Backend hosting must have <code className="font-bold">WHATSAPP_CONFIG_ENCRYPTION_KEY</code>
            {' '}set to a stable, randomly generated 64-character hex key. This key encrypts stored
            credentials; the WhatsApp access token itself is entered here, not in an environment file.
          </div>
        </aside>
      </div>
    </main>
  );
};

export default WhatsappIntegration;
