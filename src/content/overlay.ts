/**
 * overlay.ts — Content script injected into all pages.
 *
 * Listens for SHOW_OVERLAY messages from the background service worker,
 * renders a Shadow DOM overlay for domain classification, and sends
 * the user's response back.
 *
 * Uses Shadow DOM to avoid CSS conflicts with the host page.
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
  // Remove any existing overlay
  if (overlayHost) {
    overlayHost.remove();
    overlayHost = null;
  }

  const { domain, aiGuess } = message;

  // Create host element + shadow root
  const host = document.createElement('div');
  host.id = 'drift-overlay-host';
  host.style.cssText = `
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
  `;

  const shadow = host.attachShadow({ mode: 'closed' });
  overlayHost = host;
  document.documentElement.appendChild(host);

  // Build overlay HTML inside shadow root
  const container = document.createElement('div');
  container.style.cssText = `
    pointer-events: all;
    background: #1a1a2e;
    color: #e8e8f0;
    border-radius: 0 0 12px 12px;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    min-width: 480px;
    max-width: 640px;
    border: 1px solid rgba(255,255,255,0.08);
    border-top: none;
  `;

  const label = document.createElement('span');
  label.style.cssText = 'flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  label.textContent = domain;

  const aiHint = aiGuess
    ? (() => {
        const hint = document.createElement('span');
        hint.style.cssText = 'font-size: 11px; color: #8888aa; flex-shrink: 0;';
        hint.textContent = `AI: ${aiGuess}`;
        return hint;
      })()
    : null;

  const investBtn = createButton('Investment', '#22c55e', aiGuess === 'investment');
  const voidBtn = createButton('Void', '#ef4444', aiGuess === 'void');

  // Countdown bar
  const countdownBar = document.createElement('div');
  countdownBar.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 100%;
    background: rgba(255,255,255,0.15);
    border-radius: 0 0 12px 12px;
    overflow: hidden;
  `;
  const countdownFill = document.createElement('div');
  countdownFill.style.cssText = `
    height: 100%;
    width: 100%;
    background: #6366f1;
    transition: width ${OVERLAY_AUTO_DISMISS_SECONDS}s linear;
  `;
  countdownBar.appendChild(countdownFill);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative;';
  wrapper.appendChild(container);
  wrapper.appendChild(countdownBar);

  container.appendChild(label);
  if (aiHint) container.appendChild(aiHint);
  container.appendChild(investBtn);
  container.appendChild(voidBtn);

  shadow.appendChild(wrapper);

  // Start countdown animation (trigger reflow first)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      countdownFill.style.width = '0%';
    });
  });

  // Auto-dismiss timer
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

function createButton(label: string, color: string, highlighted: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = `
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid ${color};
    background: ${highlighted ? color : 'transparent'};
    color: ${highlighted ? '#fff' : color};
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
    font-family: inherit;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.background = color;
    btn.style.color = '#fff';
  });
  btn.addEventListener('mouseleave', () => {
    if (!btn.dataset.active) {
      btn.style.background = highlighted ? color : 'transparent';
      btn.style.color = highlighted ? '#fff' : color;
    }
  });
  return btn;
}

function sendResponse(domain: string, choice: Classification | 'dismissed'): void {
  chrome.runtime.sendMessage({
    type: 'CLASSIFICATION_RESPONSE',
    domain,
    choice,
  }).catch(() => {
    // Background SW may be inactive — ignore
  });
}

function removeOverlay(): void {
  if (overlayHost) {
    overlayHost.style.transition = 'opacity 0.2s';
    overlayHost.style.opacity = '0';
    setTimeout(() => {
      overlayHost?.remove();
      overlayHost = null;
    }, 200);
  }
}
