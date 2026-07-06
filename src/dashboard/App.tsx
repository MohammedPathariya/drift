/**
 * Dashboard — V3 visualization scaffold.
 *
 * In V1 this shows today's summary + a history table.
 * Full chart visualizations (Recharts) will be added in V3.
 */

import { useEffect, useState } from 'react';
import type { DriftStorage, DailyRecord } from '../shared/types';
import { formatMinutes, checkingRemainingPercent } from '../shared/utils';

interface DashboardState {
  loaded: boolean;
  today: {
    investmentMinutes: number;
    voidMinutes: number;
    pendingMinutes: number;
    checkingSpentMinutes: number;
    dailyTargetMinutes: number;
  };
  history: DailyRecord[];
}

export default function App() {
  const [state, setState] = useState<DashboardState>({
    loaded: false,
    today: {
      investmentMinutes: 0,
      voidMinutes: 0,
      pendingMinutes: 0,
      checkingSpentMinutes: 0,
      dailyTargetMinutes: 480,
    },
    history: [],
  });

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    const items = await chrome.storage.local.get(null) as Partial<DriftStorage>;
    setState({
      loaded: true,
      today: {
        investmentMinutes: items.today?.investmentMinutes ?? 0,
        voidMinutes: items.today?.voidMinutes ?? 0,
        pendingMinutes: items.today?.pendingMinutes ?? 0,
        checkingSpentMinutes: items.today?.checkingSpentMinutes ?? 0,
        dailyTargetMinutes: items.dailyTargetMinutes ?? 480,
      },
      history: items.history ?? [],
    });
  }

  if (!state.loaded) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const { today } = state;
  const remainPercent = checkingRemainingPercent(
    today.checkingSpentMinutes,
    today.dailyTargetMinutes,
  );

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <header style={styles.header}>
          <h1 style={styles.logo}>Drift</h1>
          <span style={styles.headerSub}>Dashboard</span>
        </header>

        {/* Today's summary */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Today</h2>
          <div style={styles.statsGrid}>
            <StatCard
              label="Checking Remaining"
              value={`${Math.round(remainPercent)}%`}
              sub={`${formatMinutes(Math.max(0, today.dailyTargetMinutes - today.checkingSpentMinutes))} left`}
              color="#6366f1"
            />
            <StatCard
              label="Investment"
              value={formatMinutes(today.investmentMinutes)}
              sub={`${Math.round((today.investmentMinutes / today.dailyTargetMinutes) * 100)}% of budget`}
              color="#22c55e"
            />
            <StatCard
              label="Void"
              value={formatMinutes(today.voidMinutes)}
              sub={`${Math.round((today.voidMinutes / today.dailyTargetMinutes) * 100)}% of budget`}
              color="#ef4444"
            />
            {today.pendingMinutes > 0 && (
              <StatCard
                label="Pending"
                value={formatMinutes(today.pendingMinutes)}
                sub="Awaiting classification"
                color="#f59e0b"
              />
            )}
          </div>
        </section>

        {/* History table */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>History</h2>
          {state.history.length === 0 ? (
            <p style={styles.empty}>No history yet. Past days will appear here.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Target</th>
                  <th style={styles.th}>Investment</th>
                  <th style={styles.th}>Void</th>
                  <th style={styles.th}>Ratio</th>
                </tr>
              </thead>
              <tbody>
                {[...state.history].reverse().map((record) => {
                  const total = record.investmentMinutes + record.voidMinutes;
                  const ratio = total > 0
                    ? Math.round((record.investmentMinutes / total) * 100)
                    : 0;
                  return (
                    <tr key={record.date} style={styles.tr}>
                      <td style={styles.td}>{record.date}</td>
                      <td style={styles.td}>{formatMinutes(record.dailyTargetMinutes)}</td>
                      <td style={{ ...styles.td, color: '#22c55e' }}>
                        {formatMinutes(record.investmentMinutes)}
                      </td>
                      <td style={{ ...styles.td, color: '#ef4444' }}>
                        {formatMinutes(record.voidMinutes)}
                      </td>
                      <td style={{ ...styles.td, color: ratio >= 50 ? '#22c55e' : '#ef4444' }}>
                        {ratio}% invest
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <p style={styles.v3Note}>
          Full chart visualizations coming in V3.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div style={{ ...styles.statCard, borderColor: `${color}33` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statSub}>{sub}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f1a',
    padding: '32px 24px',
  } as React.CSSProperties,

  inner: {
    maxWidth: 900,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 40,
  },

  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 16,
  },

  logo: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 4,
    textTransform: 'uppercase' as const,
    color: '#6366f1',
  } as React.CSSProperties,

  headerSub: {
    fontSize: 13,
    color: '#555577',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  } as React.CSSProperties,

  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    color: '#555577',
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
  } as React.CSSProperties,

  statCard: {
    background: '#1a1a2e',
    border: '1px solid',
    borderRadius: 12,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },

  statLabel: {
    fontSize: 11,
    color: '#555577',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  } as React.CSSProperties,

  statValue: {
    fontSize: 32,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  statSub: {
    fontSize: 12,
    color: '#666688',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },

  th: {
    textAlign: 'left' as const,
    padding: '10px 16px',
    color: '#555577',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },

  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },

  td: {
    padding: '12px 16px',
    color: '#9999bb',
    fontVariantNumeric: 'tabular-nums' as const,
  },

  empty: {
    color: '#555577',
    fontSize: 14,
    fontStyle: 'italic' as const,
  },

  loading: {
    padding: 40,
    color: '#555577',
    fontSize: 14,
  },

  v3Note: {
    fontSize: 12,
    color: '#333355',
    fontStyle: 'italic' as const,
  },
};
