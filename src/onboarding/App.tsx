import { useState } from 'react';

type Step = 'welcome' | 'target' | 'apikey' | 'done';

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

  const stepIndex = { welcome: 0, target: 1, apikey: 2, done: 3 }[step];

  return (
    <div style={s.page}>
      {/* Background aura */}
      <div style={s.aura} />

      <div style={s.container}>
        {/* Step dots */}
        {step !== 'done' && (
          <div style={s.dots}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  ...s.dot,
                  background: i <= stepIndex
                    ? '#6366f1'
                    : 'rgba(255,255,255,0.1)',
                  width: i === stepIndex ? 20 : 6,
                }}
              />
            ))}
          </div>
        )}

        {/* Card */}
        <div style={s.card}>
          {step === 'welcome' && <Welcome onNext={() => setStep('target')} />}
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
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={s.stepContent}>
      <div style={s.wordmark}>Drift</div>
      <h1 style={s.title}>Your browser time,<br />as a financial ledger.</h1>
      <p style={s.body}>
        Every minute you spend online is either an{' '}
        <span style={{ color: '#22c55e', fontWeight: 600 }}>investment</span>
        {' '}— learning, building, creating — or{' '}
        <span style={{ color: '#ef4444', fontWeight: 600 }}>void</span>
        {' '}— passive consumption. Drift tracks the balance.
      </p>
      <div style={s.featureList}>
        {[
          ['Live badge', 'Percentage of checking account remaining, always visible.'],
          ['Auto-classify', 'AI guesses each new domain. You confirm in a quick overlay.'],
          ['History', 'See your investment vs void ratio over time.'],
        ].map(([title, desc]) => (
          <div key={title} style={s.featureItem}>
            <div style={s.featureDot} />
            <div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{title} — </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
            </div>
          </div>
        ))}
      </div>
      <button style={s.primaryBtn} onClick={onNext}>Get Started →</button>
    </div>
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
    <div style={s.stepContent}>
      <div style={s.stepLabel}>Step 1 of 2</div>
      <h2 style={s.title}>Set your daily<br />time budget.</h2>
      <p style={s.body}>
        This is your <span style={{ color: '#6366f1', fontWeight: 600 }}>Checking Account</span> — the
        total active browser time you're comfortable spending per day.
      </p>

      {/* Big number display */}
      <div style={s.hourDisplay}>
        <span style={s.hourNumber}>{hours}</span>
        <span style={s.hourUnit}>hours / day</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={16}
        value={hours}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#6366f1' }}
      />
      <div style={s.sliderLabels}>
        <span>1h</span>
        <span>8h</span>
        <span>16h</span>
      </div>

      {/* Quick picks */}
      <div style={s.chipRow}>
        {[2, 4, 6, 8, 10, 12].map((h) => (
          <button
            key={h}
            style={{ ...s.chip, ...(hours === h ? s.chipActive : {}) }}
            onClick={() => onChange(h)}
          >
            {h}h
          </button>
        ))}
      </div>

      <button style={s.primaryBtn} onClick={onNext}>Continue →</button>
    </div>
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
    <div style={s.stepContent}>
      <div style={s.stepLabel}>Step 2 of 2</div>
      <h2 style={s.title}>AI classification.<br />Optional but recommended.</h2>
      <p style={s.body}>
        Drift uses <strong style={{ color: 'rgba(255,255,255,0.7)' }}>GPT-4o-mini</strong> to
        automatically guess whether a new domain is investment or void.
        Without a key, you'll classify manually via a small overlay.
      </p>

      <div style={s.inputWrapper}>
        <input
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          style={s.input}
          autoComplete="off"
          spellCheck={false}
        />
        {apiKey && (
          <div style={s.inputCheck}>✓</div>
        )}
      </div>

      <p style={s.hint}>
        Stored locally only. Never sent anywhere except directly to OpenAI.
      </p>

      <div style={s.btnRow}>
        <button style={s.ghostBtn} onClick={onNext} disabled={saving}>
          Skip
        </button>
        <button style={s.primaryBtn} onClick={onNext} disabled={saving}>
          {saving ? 'Saving...' : 'Finish Setup →'}
        </button>
      </div>
    </div>
  );
}

function Done() {
  return (
    <div style={{ ...s.stepContent, textAlign: 'center' as const, alignItems: 'center' }}>
      <div style={s.doneIcon}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" stroke="#22c55e" strokeWidth="1.5"/>
          <path d="M10 16.5L14 20.5L22 12" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 style={s.title}>You're all set.</h2>
      <p style={s.body}>
        Drift is now running. Visit any site and the classification overlay will appear.
        Your balance lives in the badge.
      </p>
      <button style={s.primaryBtn} onClick={() => window.close()}>
        Close & Start Tracking
      </button>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#07090f',
    position: 'relative' as const,
    overflow: 'hidden',
  },

  aura: {
    position: 'fixed' as const,
    top: '-30%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 800,
    height: 600,
    background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },

  container: {
    width: '100%',
    maxWidth: 520,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
    position: 'relative' as const,
    zIndex: 1,
  },

  dots: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dot: {
    height: 6,
    borderRadius: 3,
    transition: 'all 0.3s ease',
  },

  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    overflow: 'hidden',
  },

  stepContent: {
    padding: '36px 36px 32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
  },

  wordmark: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    color: '#6366f1',
  },

  stepLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.2)',
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: '-0.02em',
  },

  body: {
    fontSize: 14,
    lineHeight: 1.75,
    color: 'rgba(255,255,255,0.38)',
  },

  featureList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    padding: '4px 0',
  },

  featureItem: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    fontSize: 13,
    lineHeight: 1.5,
  },

  featureDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#6366f1',
    marginTop: 5,
    flexShrink: 0,
  },

  hourDisplay: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },

  hourNumber: {
    fontSize: 56,
    fontWeight: 700,
    color: '#6366f1',
    letterSpacing: '-0.03em',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  hourUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
  },

  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginTop: -4,
  },

  chipRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },

  chip: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.35)',
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },

  chipActive: {
    background: 'rgba(99,102,241,0.2)',
    borderColor: 'rgba(99,102,241,0.5)',
    color: '#a5b4fc',
  },

  inputWrapper: {
    position: 'relative' as const,
  },

  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    padding: '12px 16px',
    outline: 'none',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  },

  inputCheck: {
    position: 'absolute' as const,
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 700,
  },

  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.18)',
    lineHeight: 1.6,
    marginTop: -4,
  },

  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },

  primaryBtn: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
    alignSelf: 'flex-start' as const,
  },

  ghostBtn: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.3)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
} satisfies Record<string, React.CSSProperties>;
