import { useState } from 'react';

type Step = 'welcome' | 'target' | 'apikey' | 'done';

const MIN_HOURS = 1;
const MAX_HOURS = 16;

export default function App() {
  const [step, setStep] = useState<Step>('welcome');
  const [dailyHours, setDailyHours] = useState(8);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    await chrome.storage.local.set({
      onboardingComplete: true,
      dailyTargetMinutes: dailyHours * 60,
      openaiApiKey: apiKey.trim() || undefined,
    });
    setStep('done');
    setSaving(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {step === 'welcome' && (
          <Welcome onNext={() => setStep('target')} />
        )}
        {step === 'target' && (
          <DailyTarget
            hours={dailyHours}
            onChange={setDailyHours}
            onNext={() => setStep('apikey')}
          />
        )}
        {step === 'apikey' && (
          <ApiKey
            apiKey={apiKey}
            onChange={setApiKey}
            onNext={finish}
            saving={saving}
          />
        )}
        {step === 'done' && <Done />}
      </div>
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div style={styles.logo}>Drift</div>
      <h1 style={styles.title}>Your browser time as a financial ledger.</h1>
      <p style={styles.body}>
        Every minute online is either an <strong style={{ color: '#22c55e' }}>investment</strong> (learning, building, creating)
        or <strong style={{ color: '#ef4444' }}>void</strong> (passive consumption).
        Drift tracks the balance so you can see where your time actually goes.
      </p>
      <button style={styles.primaryBtn} onClick={onNext}>
        Get Started
      </button>
    </>
  );
}

function DailyTarget({
  hours,
  onChange,
  onNext,
}: {
  hours: number;
  onChange: (h: number) => void;
  onNext: () => void;
}) {
  return (
    <>
      <h2 style={styles.title}>Set your daily time budget</h2>
      <p style={styles.body}>
        This is your <em>Checking Account</em> — the maximum active browser time you budget per day.
        Investment time earns its keep; void time drains it.
      </p>

      <div style={styles.sliderContainer}>
        <input
          type="range"
          min={MIN_HOURS}
          max={MAX_HOURS}
          value={hours}
          onChange={(e) => onChange(Number(e.target.value))}
          style={styles.slider}
        />
        <div style={styles.sliderValue}>{hours}h / day</div>
      </div>

      <div style={styles.hoursGrid}>
        {[2, 4, 6, 8, 10, 12].map((h) => (
          <button
            key={h}
            style={{ ...styles.chipBtn, ...(hours === h ? styles.chipActive : {}) }}
            onClick={() => onChange(h)}
          >
            {h}h
          </button>
        ))}
      </div>

      <button style={styles.primaryBtn} onClick={onNext}>
        Continue
      </button>
    </>
  );
}

function ApiKey({
  apiKey,
  onChange,
  onNext,
  saving,
}: {
  apiKey: string;
  onChange: (k: string) => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <>
      <h2 style={styles.title}>OpenAI API key (optional)</h2>
      <p style={styles.body}>
        Drift uses GPT-4o-mini to automatically classify new sites.
        Without a key, you'll classify sites manually via a small overlay.
      </p>

      <input
        type="password"
        placeholder="sk-..."
        value={apiKey}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
        autoComplete="off"
        spellCheck={false}
      />

      <p style={{ ...styles.body, fontSize: 12, color: '#666688', marginTop: 8 }}>
        Your key is stored locally and never sent anywhere except OpenAI.
      </p>

      <div style={styles.btnRow}>
        <button
          style={styles.secondaryBtn}
          onClick={onNext}
          disabled={saving}
        >
          Skip
        </button>
        <button
          style={styles.primaryBtn}
          onClick={onNext}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Finish Setup'}
        </button>
      </div>
    </>
  );
}

function Done() {
  return (
    <>
      <div style={{ fontSize: 48, textAlign: 'center' as const }}>
      </div>
      <h2 style={styles.title}>You're all set.</h2>
      <p style={styles.body}>
        Drift is now tracking your time. Visit any site and the classification overlay will appear.
        Check your balance anytime via the extension badge.
      </p>
      <button style={styles.primaryBtn} onClick={() => window.close()}>
        Close
      </button>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#0f0f1a',
  } as React.CSSProperties,

  card: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 48,
    maxWidth: 560,
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  } as React.CSSProperties,

  logo: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 4,
    textTransform: 'uppercase' as const,
    color: '#6366f1',
  },

  title: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.3,
    color: '#f0f0ff',
  } as React.CSSProperties,

  body: {
    fontSize: 15,
    lineHeight: 1.7,
    color: '#9999bb',
  } as React.CSSProperties,

  primaryBtn: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 28px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  secondaryBtn: {
    background: 'transparent',
    color: '#9999bb',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as React.CSSProperties,

  slider: {
    flex: 1,
    accentColor: '#6366f1',
  } as React.CSSProperties,

  sliderValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#6366f1',
    minWidth: 64,
    textAlign: 'right' as const,
  },

  hoursGrid: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },

  chipBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6,
    color: '#9999bb',
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  chipActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: '#fff',
  } as React.CSSProperties,

  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#e8e8f0',
    fontSize: 14,
    padding: '12px 16px',
    width: '100%',
    outline: 'none',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  btnRow: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  } as React.CSSProperties,
};
