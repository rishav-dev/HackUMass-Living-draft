import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Sparkles } from 'lucide-react';
import type { AiStatusDto } from '@living-draft/contracts';
import { AI_KEY, useAiStatus } from '../../api/ai';
import { api, ON_DEVICE } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, Select, TextInput, Toggle } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';

interface ConnectionView {
  enabled: boolean;
  endpoint: string;
  model: string;
  hasKey: boolean;
  fromEnvironment: boolean;
}

const SERVICES = [
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct',
  },
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'other', label: 'Another service', endpoint: '', model: '' },
];

const hostOf = (endpoint: string) => {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
};

function Hosted({ status }: { status: AiStatusDto | undefined }) {
  const client = useQueryClient();
  const toast = useToast();
  const { data: current } = useQuery({
    queryKey: ['ai', 'connection'],
    queryFn: () => api.get<ConnectionView | null>('/ai/connection'),
  });
  const [editing, setEditing] = useState(false);
  const [service, setService] = useState('groq');
  const [endpoint, setEndpoint] = useState(SERVICES[0]!.endpoint);
  const [model, setModel] = useState(SERVICES[0]!.model);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['ai'] });
    await client.invalidateQueries({ queryKey: AI_KEY });
  };
  const fail = (err: unknown) =>
    setError(err instanceof Error ? err.message : 'That did not work.');

  const begin = () => {
    if (current) {
      const known = SERVICES.find((s) => s.endpoint === current.endpoint);
      setService(known?.id ?? 'other');
      setEndpoint(current.endpoint);
      setModel(current.model);
    }
    setKey('');
    setError(null);
    setEditing(true);
  };

  const save = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api.put('/ai/connection', {
        enabled,
        endpoint,
        model,
        ...(key.trim() ? { apiKey: key.trim() } : {}),
      });
      await refresh();
      setEditing(false);
      setKey('');
      toast(
        enabled ? `The writing helper now uses ${hostOf(endpoint)}.` : 'Saved, but switched off.',
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (enabled: boolean) => {
    if (!current) return;
    setError(null);
    try {
      await api.put('/ai/connection', {
        enabled,
        endpoint: current.endpoint,
        model: current.model,
      });
      await refresh();
    } catch (err) {
      fail(err);
    }
  };

  const test = async () => {
    setBusy(true);
    setError(null);
    try {
      const { reply } = await api.post<{ reply: string }>('/ai/connection/test');
      toast(`It answered: “${reply}”`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    await api.delete('/ai/connection');
    await refresh();
    toast('The service and its key are gone from this notebook.');
  };

  return (
    <div className="mt-6 rounded-2xl bg-white/4 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Cloud className="size-4 text-lavender-deep" /> Use a hosted model
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {ON_DEVICE
          ? 'This version runs in your browser, so the writing helper needs a model service. Answers come back in seconds.'
          : 'Much faster than the model on this computer: answers in seconds instead of minutes.'}{' '}
        Paste a key from a service that speaks the OpenAI chat format, such as Groq, OpenRouter or
        OpenAI.
      </p>

      {current?.fromEnvironment ? (
        <p className="mt-3 text-sm">
          Set up on the server with <code>LIVING_DRAFT_AI_URL</code>: {current.model} at{' '}
          {hostOf(current.endpoint)}.
        </p>
      ) : current && !editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <Toggle
            checked={current.enabled}
            onChange={(on) => void toggle(on)}
            label={`${current.model} at ${hostOf(current.endpoint)}`}
            description={
              current.enabled
                ? status?.where === 'remote'
                  ? 'The writing helper is using it now.'
                  : 'On.'
                : ON_DEVICE
                  ? 'Off. The quick first pass does the reading.'
                  : 'Off. The writing helper uses this computer instead.'
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" disabled={busy} onClick={() => void test()}>
              Test it
            </Button>
            <Button size="sm" variant="ghost" onClick={begin}>
              Change
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void forget()}>
              Forget it
            </Button>
          </div>
        </div>
      ) : editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Service" htmlFor="ai-service">
            <Select
              id="ai-service"
              value={service}
              onChange={(e) => {
                const next = SERVICES.find((s) => s.id === e.target.value)!;
                setService(next.id);
                if (next.id !== 'other') {
                  setEndpoint(next.endpoint);
                  setModel(next.model);
                }
              }}
            >
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          {service === 'other' && (
            <Field
              label="Address"
              htmlFor="ai-endpoint"
              hint="Ends in /v1, like https://api.example.com/v1"
            >
              <TextInput
                id="ai-endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://"
              />
            </Field>
          )}
          <Field
            label="Model"
            htmlFor="ai-model"
            hint="Any chat model from the service’s list. Bigger models write better and cost more."
          >
            <TextInput id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field
            label="API key"
            htmlFor="ai-key"
            hint={current?.hasKey ? 'Leave it empty to keep the key you saved.' : ' '}
          >
            <TextInput
              id="ai-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={current?.hasKey ? 'Saved' : ''}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={
                busy || !endpoint.trim() || !model.trim() || (!key.trim() && !current?.hasKey)
              }
              onClick={() => void save(true)}
            >
              {busy ? 'Saving…' : 'Save and use it'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="soft" className="mt-3" onClick={begin}>
          Connect a service
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-deep">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-soft">
        While this is on, the memory text the helper works on goes to that service to be processed,
        over an encrypted connection. The service can read it while it works, so pick one whose
        privacy terms you’re comfortable with. The key stays in this notebook and is never included
        in exports.
      </p>
    </div>
  );
}

export function WritingHelperSection() {
  const { data: status } = useAiStatus();
  const client = useQueryClient();
  const start = () =>
    api
      .post<AiStatusDto>('/ai/prepare')
      .then((next) => client.setQueryData(AI_KEY, next))
      .catch(() => undefined);

  return (
    <section id="writing-helper" className="paper scroll-mt-24 rounded-3xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <Sparkles className="size-5 text-lavender-deep" />
        Writing helper
      </h2>
      <p className="text-sm text-ink-soft">
        It reads each memory properly: rewrites it into something you&apos;ll want to read later,
        gives it a title that gets the point, picks out who mattered and how it felt, asks a few
        follow-up questions, and answers what you ask about your own stories.
      </p>

      {!status || status.where === 'none' ? (
        <p className="mt-4 text-sm text-ink-soft">
          No model is connected yet, so the quick first pass does the reading.
        </p>
      ) : status.where === 'remote' ? (
        <p className="mt-4 text-sm font-semibold">Using {status.model} through a hosted service.</p>
      ) : status.status === 'loading' ? (
        <div className="mt-4 max-w-sm">
          <p className="text-xs font-semibold text-ink-soft">
            {status.downloaded
              ? 'Starting it up…'
              : `Downloading ${status.model}… ${Math.round(status.progress * 100)}%`}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lavender via-magenta to-gold transition-all duration-500"
              style={{ width: `${Math.max(3, status.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : status.status === 'ready' ? (
        <p className="mt-4 text-sm font-semibold">
          {status.model} is ready on this computer{status.gpu ? `, using ${status.gpu}` : ''}.
        </p>
      ) : status.status === 'failed' ? (
        <p className="mt-4 text-sm text-ink-soft">
          {status.reason}{' '}
          <button type="button" className="font-semibold text-ink underline" onClick={start}>
            Try again
          </button>
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={start}>
            {status.downloaded ? 'Start it' : `Download it (${status.sizeLabel ?? 'about 2.4 GB'})`}
          </Button>
        </div>
      )}

      {status?.where === 'local' && (
        <p className="mt-3 text-xs text-ink-soft">
          It&apos;s {status.model}, an open model that runs entirely on this computer. The first
          time, it downloads once from Hugging Face. Your memories are never sent anywhere. On a
          laptop it takes a little while per memory, so it works in the background while you look
          things over.
        </p>
      )}

      <Hosted status={status} />
    </section>
  );
}
