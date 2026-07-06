/**
 * classifier.ts — Domain classification via OpenAI + manual overlay dispatch.
 *
 * Flow:
 * 1. Check if domain is already classified → skip
 * 2. Try OpenAI if API key is set → get ai guess
 * 3. Mark domain as pending
 * 4. Send SHOW_OVERLAY message to content script with optional AI guess
 * 5. When content script responds, call settlePendingForDomain
 */

import { getStorage, setStorage } from './storage';
import { getDomainHint } from '../shared/utils';
import { OPENAI_MODEL, OPENAI_CLASSIFY_PROMPT } from '../shared/constants';
import { settlePendingForDomain } from './ledger';
import type { Classification } from '../shared/types';

/** Trigger classification flow for an unclassified domain */
export async function triggerClassification(
  domain: string,
  tabId: number,
): Promise<void> {
  const storage = await getStorage();

  // Already classified or already pending
  if (storage.domainClassifications[domain]) return;
  if (storage.pendingDomains.includes(domain)) return;

  // Mark as pending
  const pendingDomains = [...storage.pendingDomains, domain];
  await setStorage({ pendingDomains });

  // Try to get AI guess
  let aiGuess: Classification | undefined;
  if (storage.openaiApiKey) {
    aiGuess = await classifyWithOpenAI(domain, storage.openaiApiKey) ?? undefined;
  }

  // Fall back to hint-based guess if no AI
  if (!aiGuess) {
    const hint = getDomainHint(domain);
    if (hint) aiGuess = hint;
  }

  // Send overlay message to the tab
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_OVERLAY',
      domain,
      aiGuess,
    });
  } catch {
    // Tab may have navigated away or content script not ready
    // The overlay will re-trigger on next visit
  }
}

/** Call OpenAI GPT-4o-mini to classify a domain */
async function classifyWithOpenAI(
  domain: string,
  apiKey: string,
): Promise<Classification | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: OPENAI_CLASSIFY_PROMPT + domain,
          },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = data.choices[0]?.message?.content?.trim().toLowerCase();

    if (text === 'investment') return 'investment';
    if (text === 'void') return 'void';
    return null;
  } catch {
    return null;
  }
}

/** Handle classification response from content script */
export async function handleClassificationResponse(
  domain: string,
  choice: Classification | 'dismissed',
): Promise<void> {
  if (choice === 'dismissed') {
    // Remove from pending so overlay can re-trigger on next visit
    const storage = await getStorage();
    const pendingDomains = storage.pendingDomains.filter((d) => d !== domain);
    await setStorage({ pendingDomains });
    return;
  }

  await settlePendingForDomain(domain, choice);
}
