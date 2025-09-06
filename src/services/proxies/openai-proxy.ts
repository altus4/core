/**
 * OpenAI Proxy with automatic timeout handling
 *
 * Extends ExternalServiceProxy to provide OpenAI-specific functionality
 * with automatic timeout handling for all API calls.
 */
import { OpenAI } from 'openai';
import { config } from '@/config';
import { ExternalProxy } from './external-proxy';

/**
 * Proxy wrapper for OpenAI client with automatic timeout handling
 * Inherits common timeout and error handling from ExternalServiceProxy
 */
export class OpenAIProxy extends ExternalProxy {
  private openai: OpenAI;

  constructor() {
    // Call parent constructor with fixed defaults for OpenAI
    super({
      serviceName: 'OpenAI API',
      defaultTimeout: config.timeout.openai,
    });

    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
  }

  /**
   * Chat completions proxy with automatic timeout
   */
  get chat() {
    return {
      completions: {
        create: (
          body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
          options?: { timeout?: number }
        ): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
          return this.withTimeout(
            this.openai.chat.completions.create(
              body
            ) as Promise<OpenAI.Chat.Completions.ChatCompletion>,
            'chat.completions.create',
            options?.timeout
          );
        },
      },
    };
  }

  /**
   * Embeddings proxy with automatic timeout
   */
  get embeddings() {
    return {
      create: (body: OpenAI.Embeddings.EmbeddingCreateParams, options?: { timeout?: number }) => {
        return this.withTimeout(
          this.openai.embeddings.create(body),
          'embeddings.create',
          options?.timeout
        );
      },
    };
  }

  /**
   * Images proxy with automatic timeout
   */
  get images() {
    return {
      generate: (body: OpenAI.Images.ImageGenerateParams, options?: { timeout?: number }) => {
        return this.withTimeout(
          this.openai.images.generate(body),
          'images.generate',
          options?.timeout
        );
      },
    };
  }
}
