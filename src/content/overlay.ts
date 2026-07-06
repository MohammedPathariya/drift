/**
 * overlay.ts — Content script. Frosted pill classification overlay.
 *
 * Appears at the top-center of every page when a new domain needs classifying.
 * Shadow DOM keeps styles isolated from the host page.
 */

import type { ShowOverlayMessage, Classification, ExtensionMessage } from '../shared/types';
import { OVERLAY_AUTO_DISMISS_SECONDS } from '../shared/constants';

let overlayHost: HTMLElement | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'SHOW_OVERLAY') {
    showOverlay(message as ShowOverlayMessage);
  }
});

function showOverlay(message: ShowOverlayMessage): void {
  if (overlayHost) {
    overlayHost.remove();
    overlayHost = null;
  }

  const { domain, aiGuess } = message;

  const host = document.createElement('div');
  host.id = 'drift-overlay-host';
  Object.assign(host.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-8px)',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  });

  const shadow = host.attachShadow({ mode: 'closed' });
  overlayHost = host;
  document.documentElement.appendChild(host);

  // Inject Inter font inside shadow root
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;600&display=swap';
  shadow.appendChild(fontLink);

  // ── Pill container ────────────────────────────────────────────────────
  const pill = document.createElement('div');
  Object.assign(pill.style, {
    pointerEvents: 'all',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(7, 9, 15, 0.82)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.09)',
    borderRadius: '100px',
    padding: '8px 8px 8px 16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
    fontFamily: "'Inter', -apple-system, sans-serif",
    whiteSpace: 'nowrap',
    position: 'relative',
    overflow: 'hidden',
  });

  // Countdown progress bar at bottom of pill
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'absolute',
    bottom: '0',
    left: '0',
    height: '2px',
    width: '100%',
    background: 'rgba(99,102,241,0.6)',
    borderRadius: '0 0 100px 100px',
    transformOrigin: 'left center',
    transition: `transform ${OVERLAY_AUTO_DISMISS_SECONDS}s linear`,
    transform: 'scaleX(1)',
  });
  pill.appendChild(bar);

  // Domain label
  const label = document.createElement('span');
  Object.assign(label.style, {
    fontSize: '13px',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexShrink: '1',
  });
  label.textContent = domain;

  // Divider
  const divider = document.createElement('span');
  Object.assign(divider.style, {
    width: '1px',
    height: '14px',
    background: 'rgba(255,255,255,0.08)',
    flexShrink: '0',
  });

  // AI hint (if present)
  let aiHintEl: HTMLElement | null = null;
  if (aiGuess) {
    aiHintEl = document.createElement('span');
    Object.assign(aiHintEl.style, {
      fontSize: '10px',
      fontWeight: '600',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: aiGuess === 'investment' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
      flexShrink: '0',
    });
    aiHintEl.textContent = `AI: ${aiGuess}`;
  }

  // Buttons
  const investBtn = createPillBtn('Investment', '#22c55e', aiGuess === 'investment');
  const voidBtn = createPillBtn('Void', '#ef4444', aiGuess === 'void');

  pill.appendChild(label);
  pill.appendChild(divider);
  if (aiHintEl) pill.appendChild(aiHintEl);
  pill.appendChild(investBtn);
  pill.appendChild(voidBtn);

  shadow.appendChild(pill);

  // Animate in
  requestAnimationFrame(() => {
    Object.assign(host.style, {
      opacity: '1',
      transform: 'translateX(-50%) translateY(0)',
    });
    // Start countdown bar shrink
    requestAnimationFrame(() => {
      bar.style.transform = 'scaleX(0)';
    });
  });

  // Auto-dismiss
  let dismissed = false;
  const timer = setTimeout(() => {
    if (!dismissed) {
      dismissed = true;
      sendResponse(domain, 'dismissed');
      removeOverlay();
    }
  }, OVERLAY_AUTO_DISMISS_SECONDS * 1000);

  function handleChoice(choice: Classification): void {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    sendResponse(domain, choice);
    removeOverlay();
  }

  investBtn.addEventListener('click', () => handleChoice('investment'));
  voidBtn.addEventListener('click', () => handleChoice('void'));
}

function createPillBtn(label: string, color: string, highlighted: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    padding: '5px 12px',
    borderRadius: '100px',
    border: `1px solid ${highlighted ? color : 'rgba(255,255,255,0.1)'}`,
    background: highlighted ? `${color}22` : 'rgba(255,255,255,0.05)',
    color: highlighted ? color : 'rgba(255,255,255,0.45)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: '0',
    transition: 'all 0.15s ease',
    fontFamily: "inherit",
    letterSpacing: '0.01em',
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.background = `${color}25`;
    btn.style.borderColor = color;
    btn.style.color = color;
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.background = highlighted ? `${color}22` : 'rgba(255,255,255,0.05)';
    btn.style.borderColor = highlighted ? color : 'rgba(255,255,255,0.1)';
    btn.style.color = highlighted ? color : 'rgba(255,255,255,0.45)';
  });

  return btn;
}

function sendResponse(domain: string, choice: Classification | 'dismissed'): void {
  chrome.runtime.sendMessage({
    type: 'CLASSIFICATION_RESPONSE',
    domain,
    choice,
  }).catch(() => { /* SW may be inactive */ });
}

function removeOverlay(): void {
  if (!overlayHost) return;
  Object.assign(overlayHost.style, {
    opacity: '0',
    transform: 'translateX(-50%) translateY(-6px)',
  });
  setTimeout(() => {
    overlayHost?.remove();
    overlayHost = null;
  }, 220);
}
