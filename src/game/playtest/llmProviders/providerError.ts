// provider-error-retry (campaign-2 backlog #1): a tagged error for
// LLM-call failures. Providers (ClaudeCodeProvider, AnthropicProvider)
// throw this — NOT a plain Error — so the runner can distinguish a
// transient LLM-subprocess/API failure (retryable; surfaces as
// `providerError`) from a genuine engine/host crash (engineHalt). The
// operator-facing message text is unchanged; only the class differs.

export class ProviderCallError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ProviderCallError';
    if (options?.cause !== undefined) {
      // Preserve the underlying cause (e.g. an SDK error) without
      // requiring the lib ES2022 `cause` typing everywhere.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}
