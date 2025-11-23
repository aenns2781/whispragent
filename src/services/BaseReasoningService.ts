export interface ReasoningConfig {
  maxTokens?: number;
  temperature?: number;
  contextSize?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  clipboardContext?: string;
  screenshot?: string; // Base64 encoded screenshot
  customPrompts?: any;
  abortSignal?: AbortSignal; // For cancelling requests
}

export abstract class BaseReasoningService {
  protected isProcessing = false;

  /**
   * Get reasoning prompt
   */
  protected getReasoningPrompt(
    text: string,
    agentName: string | null,
    config: ReasoningConfig = {}
  ): string {
    // Default prompts
    const DEFAULT_AGENT_PROMPT = `You are {{agentName}}, a helpful AI assistant. When the user addresses you by name, they are giving you an instruction or request. Follow their instruction and provide a helpful response. Remove any reference to your name from the output. Output ONLY the response to their request:\n\n{{text}}`;
    const DEFAULT_REGULAR_PROMPT = `Process the following transcribed speech. If it's a command or request, execute it. If it's dictation, clean it up. Output ONLY the result without any explanations:\n\n{{text}}`;

    // Get custom prompts from localStorage if available
    let agentPrompt = DEFAULT_AGENT_PROMPT;
    let regularPrompt = DEFAULT_REGULAR_PROMPT;

    if (typeof window !== 'undefined' && window.localStorage) {
      const customPrompts = window.localStorage.getItem('customPrompts');
      if (customPrompts) {
        try {
          const parsed = JSON.parse(customPrompts);
          agentPrompt = parsed.agent || DEFAULT_AGENT_PROMPT;
          regularPrompt = parsed.regular || DEFAULT_REGULAR_PROMPT;
        } catch (error) {
          console.error('Failed to parse custom prompts:', error);
        }
      }
    }

    // Check if there's clipboard context to include
    let finalText = text;
    if (config.clipboardContext) {
      // Check if user references "this/that" or if the voice command is very short (likely just an instruction)
      const hasContextReference = /\b(this|that|these|those|it)\b/i.test(text);
      const isShortCommand = text.trim().split(/\s+/).length <= 10; // Commands like "improve", "fix grammar", etc

      if (hasContextReference || isShortCommand) {
        // Include the context in the prompt
        // If the voice command is just an instruction, treat the highlighted text as the main content
        if (isShortCommand && !hasContextReference) {
          finalText = `User instruction: "${text}"\n\nProcess this text:\n${config.clipboardContext}`;
        } else {
          finalText = `${text}\n\nContext (highlighted/copied text):\n${config.clipboardContext}`;
        }
      } else {
        // Longer text without references - might be dictation alongside highlighted text
        finalText = `${text}\n\n(Note: The user had this text highlighted: ${config.clipboardContext})`;
      }
    }

    // ALWAYS use agent prompt when this function is called
    // We don't want "regular mode" - if reasoning is happening, it's agent mode
    // The agent prompt handles both instructions and general requests
    return agentPrompt
      .replace(/\{\{agentName\}\}/g, agentName || 'Assistant')
      .replace(/\{\{text\}\}/g, finalText);
  }

  /**
   * Calculate optimal max tokens based on input length
   */
  protected calculateMaxTokens(
    textLength: number,
    minTokens = 100,
    maxTokens = 2048,
    multiplier = 2
  ): number {
    return Math.max(minTokens, Math.min(textLength * multiplier, maxTokens));
  }

  /**
   * Check if service is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Process text with reasoning
   */
  abstract processText(
    text: string,
    modelId: string,
    agentName?: string | null,
    config?: ReasoningConfig
  ): Promise<string>;
}