// LlmProvider re-exports. Three implementations live as siblings:
//   - mockProvider: canned responses for unit tests.
//   - anthropicProvider: API-key auth via @anthropic-ai/sdk.
//   - claudeCodeProvider: subscription auth via the `claude` CLI.
//
// The agent's decide() loop only depends on the LlmProvider interface
// in `../types.ts`; the runner picks the concrete provider based on
// env / explicit `--provider` flag.

export {
  MockProvider,
  type MockProviderConfig,
  type MockProviderResponse,
} from './mockProvider';

export {
  AnthropicProvider,
  type AnthropicProviderConfig,
  type AnthropicSdkClient,
  type AnthropicSdkResponse,
} from './anthropicProvider';

export {
  ClaudeCodeProvider,
  buildToolsPromptText,
  resolveClaudeBinary,
  type ClaudeCodeProviderConfig,
  type ClaudeCodeRunFn,
  type ClaudeCodeRunOptions,
  type ClaudeCodeRunResult,
} from './claudeCodeProvider';
