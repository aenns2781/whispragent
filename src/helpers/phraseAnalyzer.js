/**
 * Phrase Analyzer for Auto-Suggestions
 * Handles pattern detection and exact phrase matching for dictionary/snippet suggestions
 */

class PhraseAnalyzer {
  constructor(dbManager) {
    this.dbManager = dbManager;
  }

  /**
   * Analyze transcription text for patterns and exact repeated phrases
   * @param {string} text - The transcription text to analyze
   * @param {object} settings - Settings passed from renderer (aiSuggestionsEnabled, openaiApiKey, aiAnalysisLastRun)
   */
  analyzeTranscription(text, settings = {}) {
    if (!text || typeof text !== 'string') return;

    // Check if AI suggestions are enabled (passed from renderer)
    const aiEnabled = settings.aiSuggestionsEnabled === true;

    console.log(`[PhraseAnalyzer] Analyzing transcription. AI mode: ${aiEnabled}, settings:`, settings);

    if (aiEnabled) {
      // AI mode: Don't do local analysis - AI will handle everything
      console.log('[PhraseAnalyzer] AI mode ON - skipping local analysis');
      // Just check if it's time for daily AI analysis
      this.checkAndRunAIAnalysis(settings);
    } else {
      // Local mode: Use pattern-based detection
      console.log('[PhraseAnalyzer] Local mode - running pattern detection');
      // 1. Detect patterns (emails, URLs, phone numbers)
      this.detectPatterns(text);

      // 2. Track complete sentences/phrases that appear exactly the same
      this.trackExactPhrases(text);

      // 3. Extract proper nouns and named entities
      this.extractNamedEntities(text);
    }
  }

  /**
   * Detect common patterns like emails, URLs, phone numbers
   * @param {string} text - Text to analyze
   */
  detectPatterns(text) {
    const patterns = [
      {
        type: 'email',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        description: 'Email address'
      },
      {
        type: 'url',
        regex: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
        description: 'URL'
      },
      {
        type: 'phone',
        regex: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        description: 'Phone number'
      }
    ];

    patterns.forEach(({ type, regex }) => {
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(match => {
          // Track each detected pattern
          this.dbManager.trackPhrase(match.trim(), type);
        });
      }
    });
  }

  /**
   * Track exact phrases that appear multiple times
   * Only suggest phrases that are repeated identically
   * @param {string} text - Text to analyze
   */
  trackExactPhrases(text) {
    // Split by sentence boundaries
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

    sentences.forEach(sentence => {
      // Track complete sentences (if reasonable length)
      if (sentence.length >= 10 && sentence.length <= 100) {
        const normalized = this.normalizePhraseForMatching(sentence);
        this.dbManager.trackPhrase(normalized, null);
      }

      // Also split by commas for clause-level phrases
      const clauses = sentence.split(',').map(c => c.trim()).filter(c => c.length > 0);
      clauses.forEach(clause => {
        if (clause.length >= 10 && clause.length <= 80 && this.isValidPhrase(clause)) {
          const normalized = this.normalizePhraseForMatching(clause);
          this.dbManager.trackPhrase(normalized, null);
        }
      });
    });
  }

  /**
   * Extract proper nouns and named entities
   * @param {string} text - Text to analyze
   */
  extractNamedEntities(text) {
    // Match capitalized words that might be names/places
    // Pattern: Capitalized word followed by optionally more capitalized words
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const matches = text.match(namePattern);

    if (matches) {
      matches.forEach(match => {
        // Only track if it's 2+ words (more likely to be a proper noun)
        const wordCount = match.split(/\s+/).length;
        if (wordCount >= 2 && match.length >= 5) {
          this.dbManager.trackPhrase(match.trim(), 'named_entity');
        }
      });
    }
  }

  /**
   * Normalize phrase for consistent matching (case-insensitive, extra whitespace removed)
   * @param {string} phrase - Phrase to normalize
   * @returns {string}
   */
  normalizePhraseForMatching(phrase) {
    return phrase
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if a phrase is valid for suggestion
   * @param {string} phrase - Phrase to check
   * @returns {boolean}
   */
  isValidPhrase(phrase) {
    // Skip if too short
    if (phrase.length < 10) return false;

    // Skip if starts or ends with common filler words
    const fillerWords = ['i', 'a', 'the', 'to', 'and', 'or', 'but', 'in', 'on', 'at', 's'];
    const words = phrase.toLowerCase().split(/\s+/);
    const firstWord = words[0];
    const lastWord = words[words.length - 1];

    if (fillerWords.includes(firstWord) || fillerWords.includes(lastWord)) {
      return false;
    }

    // Skip if contains possessive fragments like "s name" or "s email"
    if (phrase.includes(' s ') || phrase.includes("'s")) {
      return false;
    }

    // Must have at least 2 meaningful words
    const meaningfulWords = words.filter(w => w.length > 2 && !fillerWords.includes(w));
    if (meaningfulWords.length < 2) {
      return false;
    }

    return true;
  }

  /**
   * Get suggestions for dictionary or snippets
   * @param {number} minCount - Minimum frequency count (default 5 for exact phrases)
   * @returns {Array} Array of suggested phrases
   */
  getSuggestions(minCount = 5) {
    // For patterns (email, url, phone, named_entity), use lower threshold of 3
    // For regular phrases, use higher threshold of 5
    const allSuggestions = this.dbManager.getSuggestedPhrases(3);

    // Separate patterns from phrases and apply different thresholds
    return allSuggestions.filter(suggestion => {
      if (suggestion.pattern_type) {
        // Patterns: suggest after 3 occurrences
        return suggestion.count >= 3;
      } else {
        // Regular phrases: suggest after 5 occurrences (more strict)
        return suggestion.count >= minCount;
      }
    });
  }

  /**
   * Mark a phrase as suggested
   * @param {string} phrase - The phrase that was suggested
   */
  markAsSuggested(phrase) {
    return this.dbManager.markPhraseSuggested(phrase);
  }

  /**
   * Dismiss a phrase suggestion
   * @param {string} phrase - The phrase to dismiss
   */
  dismissSuggestion(phrase) {
    return this.dbManager.dismissPhraseSuggestion(phrase);
  }

  /**
   * Check if it's time to run AI analysis and do it if needed
   * AI analysis runs once per day automatically
   * @param {object} settings - Settings passed from renderer
   */
  checkAndRunAIAnalysis(settings) {
    // Check when we last ran AI analysis (passed from renderer)
    const lastRunDate = settings.aiAnalysisLastRun || '';
    const today = new Date().toDateString();

    if (lastRunDate === today) {
      // Already ran today, skip
      return { shouldUpdateLastRun: false };
    }

    // Time to run AI analysis
    console.log('[AI Suggestions] Time for daily analysis...');
    this.runAIAnalysis(settings);
    return { shouldUpdateLastRun: true, newDate: today };
  }

  /**
   * Run AI analysis on recent transcriptions
   * Uses GPT-4o-mini to analyze transcriptions and suggest dictionary/snippet items
   * @param {object} settings - Settings passed from renderer (must include openaiApiKey)
   * @param {string} mode - 'dictionary' or 'snippets' to filter suggestions
   * @returns {object} Result with suggestions array and metadata
   */
  async runAIAnalysis(settings, mode = 'dictionary') {
    try {
      console.log(`[AI Suggestions] Starting AI analysis for ${mode}...`);

      // Get recent transcriptions (last 7 days)
      const recentTranscriptions = this.dbManager.getRecentTranscriptions(7);

      if (!recentTranscriptions || recentTranscriptions.length === 0) {
        console.log('[AI Suggestions] No recent transcriptions to analyze');
        return {
          success: true,
          suggestions: [],
          transcriptionCount: 0,
          message: 'No recent transcriptions to analyze. Start dictating to build up history!'
        };
      }

      console.log(`[AI Suggestions] Analyzing ${recentTranscriptions.length} transcriptions...`);

      // Combine all transcriptions into one text block
      // Database field is 'text', not 'original_text'
      const combinedText = recentTranscriptions
        .map(t => t.text || '')
        .filter(t => t.length > 0)
        .join('\n\n');

      if (combinedText.trim().length === 0) {
        console.log('[AI Suggestions] No text to analyze');
        return {
          success: true,
          suggestions: [],
          transcriptionCount: recentTranscriptions.length,
          message: 'Transcriptions found but no text content to analyze.'
        };
      }

      // Get OpenAI API key from passed settings
      const apiKey = settings.openaiApiKey;
      if (!apiKey) {
        console.error('[AI Suggestions] No OpenAI API key provided');
        return {
          success: false,
          suggestions: [],
          error: 'No OpenAI API key configured. Add your API key in AI Models settings.'
        };
      }

      // Different prompts for dictionary vs snippets
      const dictionaryPrompt = `You are analyzing voice transcriptions for a dictation app. Your job is to identify UNIQUE, USER-SPECIFIC WORDS and SHORT TERMS that should be added to the user's personal dictionary.

PURPOSE: The dictionary stores individual words and short terms (1-4 words) that help with spelling and recognition - NOT full sentences or phrases.

FIND these types of items:
- Email addresses (john.doe@company.com)
- Phone numbers (555-123-4567)
- Names of people (first and last names)
- Company names, product names, brand names
- Technical terms and acronyms (HIPAA, Kubernetes, API, etc.)
- Industry jargon and specialized vocabulary
- Proper nouns and place names
- Words that are commonly misspelled

SKIP these:
- Full sentences or long phrases (those belong in snippets)
- Common everyday words
- Generic terms everyone uses

Return helpful suggestions when you find them. Empty array [] only if truly nothing unique.`;

      const snippetsPrompt = `You are analyzing voice transcriptions for a dictation app. Your job is to identify REPEATED PHRASES and SENTENCES that the user says often, which should be saved as snippets for quick insertion.

PURPOSE: Snippets are longer text blocks (full sentences, greetings, responses, templates) that the user can quickly insert by speaking a short trigger phrase.

FIND these types of items:
- Common greetings the user says ("Hi, thanks for reaching out...")
- Email sign-offs ("Best regards, [Name]", "Looking forward to hearing from you")
- Repeated responses or explanations they give often
- Meeting-related phrases ("Let me share my screen", "Can everyone hear me?")
- Professional phrases they use repeatedly
- Any sentence or phrase that appears multiple times

For each snippet, suggest a SHORT TRIGGER (1-3 words) that the user can speak to insert the full text. The trigger should be memorable and related to the content.

SKIP these:
- Single words or short terms (those belong in dictionary)
- Generic one-word responses
- Incomplete sentence fragments

Return helpful suggestions when you find them. Empty array [] only if truly nothing unique.`;

      const systemPrompt = mode === 'snippets' ? snippetsPrompt : dictionaryPrompt;
      const typeOptions = mode === 'snippets'
        ? 'snippet|greeting|signoff|response|template'
        : 'email|phone|name|acronym|jargon|term';

      // Different JSON format for snippets vs dictionary
      const jsonFormat = mode === 'snippets'
        ? '[{"trigger": "short trigger phrase", "phrase": "full text to insert", "type": "snippet|greeting|signoff|response|template", "reason": "brief explanation"}]'
        : '[{"phrase": "exact text", "type": "email|phone|name|acronym|jargon|term", "reason": "brief explanation"}]';

      // Call OpenAI API with gpt-4o-mini (reliable model)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Analyze these transcriptions and return ONLY a valid JSON array (no markdown, no explanation):
${jsonFormat}

Return [] if nothing unique found.

Transcriptions:
${combinedText}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[AI Suggestions] Received AI analysis response');

      // Parse the AI response
      const output = data.choices?.[0]?.message?.content || '';

      // Extract JSON from the response (handle markdown code blocks)
      let suggestions = [];
      try {
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('[AI Suggestions] Failed to parse AI response:', parseError);
        console.error('[AI Suggestions] Raw response:', output);
        return {
          success: false,
          suggestions: [],
          error: 'Failed to parse AI response'
        };
      }

      console.log(`[AI Suggestions] Found ${suggestions.length} suggestions from AI`);

      // Track each suggestion in the database
      // Add each suggestion with count of 5 so it immediately shows as a suggestion
      const addedSuggestions = [];
      suggestions.forEach(suggestion => {
        if (suggestion.phrase && suggestion.phrase.trim().length > 0) {
          // Track 5 times to meet the suggestion threshold
          for (let i = 0; i < 5; i++) {
            this.dbManager.trackPhrase(suggestion.phrase.trim(), suggestion.type || 'ai_suggested');
          }
          addedSuggestions.push(suggestion);
          console.log(`[AI Suggestions] Added: "${suggestion.phrase}" (${suggestion.type}) - ${suggestion.reason}`);
        }
      });

      console.log('[AI Suggestions] AI analysis complete');

      return {
        success: true,
        suggestions: addedSuggestions,
        transcriptionCount: recentTranscriptions.length,
        message: addedSuggestions.length > 0
          ? `Found ${addedSuggestions.length} suggestions from ${recentTranscriptions.length} transcriptions`
          : `Analyzed ${recentTranscriptions.length} transcriptions but found no unique patterns. This is normal if your dictation doesn't contain repeated phrases, email addresses, or technical terms.`
      };

    } catch (error) {
      console.error('[AI Suggestions] Error during AI analysis:', error);
      return {
        success: false,
        suggestions: [],
        error: error.message || 'Unknown error during analysis'
      };
    }
  }
}

module.exports = PhraseAnalyzer;
