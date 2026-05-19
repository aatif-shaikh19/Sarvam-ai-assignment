// tokenSimulator.js — Fake token generation at 80ms intervals

import sseManager from './sseManager.js';

// Vocabulary banks per MFE type
const VOCAB = {
  'doc-qa': [
    'The', 'document', 'analysis', 'reveals', 'that', 'key', 'findings',
    'indicate', 'a', 'significant', 'correlation', 'between', 'the',
    'proposed', 'methodology', 'and', 'observed', 'outcomes.', 'Based',
    'on', 'the', 'extracted', 'data,', 'we', 'can', 'conclude',
    'the', 'primary', 'hypothesis', 'is', 'supported', 'by',
    'empirical', 'evidence.', 'Furthermore,', 'the', 'contextual',
    'embedding', 'vectors', 'demonstrate', 'high', 'semantic',
    'similarity', 'across', 'relevant', 'passages.', 'The', 'retrieval',
    'augmented', 'generation', 'pipeline', 'successfully', 'identified',
    'three', 'key', 'reference', 'sections', 'from', 'the', 'source',
    'material.', 'In', 'summary,', 'the', 'answer', 'to', 'your',
    'query', 'is', 'derived', 'from', 'section', '4.2', 'of',
    'the', 'uploaded', 'document,', 'which', 'states', 'that',
    'performance', 'metrics', 'exceeded', 'baseline', 'expectations',
    'by', 'approximately', '23%.', 'Additional', 'context', 'was',
    'gathered', 'from', 'the', 'appendix', 'tables', 'showing',
    'quarterly', 'trend', 'analysis.', 'The', 'confidence', 'score',
    'for', 'this', 'response', 'is', '0.94,', 'indicating', 'high',
    'reliability.', 'Would', 'you', 'like', 'me', 'to', 'elaborate',
    'on', 'any', 'specific', 'section?',
  ],
  meeting: [
    'Meeting', 'Summary:', 'The', 'team', 'discussed', 'several',
    'critical', 'action', 'items', 'during', 'today\'s', 'sync.',
    'First,', 'the', 'product', 'roadmap', 'was', 'reviewed', 'with',
    'emphasis', 'on', 'Q3', 'deliverables.', 'Key', 'decisions:',
    '1)', 'Migration', 'to', 'the', 'new', 'microservices', 'architecture',
    'will', 'begin', 'next', 'sprint.', '2)', 'The', 'design',
    'team', 'will', 'finalize', 'the', 'component', 'library', 'by',
    'Friday.', '3)', 'Budget', 'allocation', 'for', 'cloud',
    'infrastructure', 'was', 'approved.', 'Action', 'items:', '-',
    'Sarah:', 'prepare', 'technical', 'specification', 'document.',
    '-', 'Mike:', 'schedule', 'stakeholder', 'review.', '-', 'Team:',
    'complete', 'sprint', 'retrospective.', 'Follow-up', 'meeting',
    'scheduled', 'for', 'Thursday', '2:00', 'PM.', 'Risk',
    'assessment:', 'timeline', 'dependencies', 'on', 'external',
    'vendor', 'API', 'integration', 'remain', 'the', 'primary',
    'blocker.', 'Overall', 'sentiment:', 'positive', 'with',
    'clear', 'alignment', 'on', 'priorities.',
  ],
};

class TokenSimulator {
  constructor() {
    /** @type {Map<string, NodeJS.Timer>} */
    this.activeTimers = new Map();
  }

  /**
   * Start token generation for a request
   * @param {object} request - { id, mfeId, clientId, device }
   * @param {function} onComplete - called when generation finishes
   */
  start(request, onComplete) {
    const vocab = VOCAB[request.mfeId] || VOCAB['doc-qa'];
    const totalTokens = 40 + Math.floor(Math.random() * 80); // 40-120 tokens
    const baseInterval = 80; // 80ms per token
    const interval = Math.round(baseInterval * (request.device?.latencyMultiplier || 1.0));
    let tokenIndex = 0;
    const tokens = [];

    // Pick random tokens from the vocabulary
    for (let i = 0; i < totalTokens; i++) {
      tokens.push(vocab[Math.floor(Math.random() * vocab.length)]);
    }

    const timer = setInterval(() => {
      if (tokenIndex >= totalTokens) {
        clearInterval(timer);
        this.activeTimers.delete(request.id);

        // Send completion event
        sseManager.broadcast('token', {
          requestId: request.id,
          mfeId: request.mfeId,
          type: 'complete',
          totalTokens,
          fullText: tokens.join(' '),
        });

        onComplete(request.id);
        return;
      }

      const token = tokens[tokenIndex];
      tokenIndex++;

      // Send token event
      sseManager.broadcast('token', {
        requestId: request.id,
        mfeId: request.mfeId,
        type: 'token',
        token,
        index: tokenIndex,
        totalTokens,
        progress: Math.round((tokenIndex / totalTokens) * 100),
      });
    }, interval);

    this.activeTimers.set(request.id, timer);
  }

  /** Cancel token generation for a request */
  cancel(requestId) {
    const timer = this.activeTimers.get(requestId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(requestId);
    }
  }
}

export default new TokenSimulator();
