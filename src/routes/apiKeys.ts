/**
 * API Key Routes
 *
 * Provides endpoints for API key management including creation, listing, updating, and revocation.
 * These routes allow users to manage their API keys for B2B service integration.
 *
 * Routes:
 *   - POST /api/keys - Create new API key
 *   - GET /api/keys - List user's API keys
 *   - PUT /api/keys/:keyId - Update API key
 *   - DELETE /api/keys/:keyId - Revoke API key
 *   - GET /api/keys/:keyId/usage - Get API key usage statistics
 *   - POST /api/keys/:keyId/regenerate - Regenerate API key
 */
import { ApiKeyController } from '@/controllers/ApiKeyController';
import { authenticate } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rateLimiter';
import { Router } from 'express';

const router = Router();
const apiKeyController = new ApiKeyController();

// Apply rate limiting to all API key routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route POST /api/keys
 * @desc Create a new API key
 * @access Private (requires valid API key with appropriate permissions)
 */
router.post('/', async (req, res) => {
  await apiKeyController.createApiKey(req, res);
});

/**
 * @route GET /api/keys
 * @desc List user's API keys
 * @access Private (requires valid API key)
 */
router.get('/', async (req, res) => {
  await apiKeyController.listApiKeys(req, res);
});

/**
 * @route PUT /api/keys/:keyId
 * @desc Update an API key's properties
 * @access Private (requires valid API key with admin permission)
 */
router.put('/:keyId', async (req, res) => {
  await apiKeyController.updateApiKey(req, res);
});

/**
 * @route DELETE /api/keys/:keyId
 * @desc Revoke (deactivate) an API key
 * @access Private (requires valid API key with admin permission)
 */
router.delete('/:keyId', async (req, res) => {
  await apiKeyController.revokeApiKey(req, res);
});

/**
 * @route GET /api/keys/:keyId/usage
 * @desc Get API key usage statistics
 * @access Private (requires valid API key)
 */
router.get('/:keyId/usage', async (req, res) => {
  await apiKeyController.getApiKeyUsage(req, res);
});

/**
 * @route POST /api/keys/:keyId/regenerate
 * @desc Regenerate an API key (creates new secret)
 * @access Private (requires valid API key with admin permission)
 */
router.post('/:keyId/regenerate', async (req, res) => {
  await apiKeyController.regenerateApiKey(req, res);
});

export default router;
