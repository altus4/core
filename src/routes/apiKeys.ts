/**
 * API Key Routes
 *
 * Provides endpoints for API key management including creation, listing, updating, and revocation.
 * These routes allow users to manage their API keys for B2B service integration.
 * Uses JWT authentication since users need to be logged in to manage their API keys.
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

// Apply JWT authentication to all routes
router.use(authenticate);

/**
 * @route POST /api/keys
 * @desc Create a new API key
 * @access Private (requires JWT authentication)
 */
router.post('/', async (req, res) => {
  await apiKeyController.createApiKey(req, res);
});

/**
 * @route GET /api/keys
 * @desc List user's API keys
 * @access Private (requires JWT authentication)
 */
router.get('/', async (req, res) => {
  await apiKeyController.listApiKeys(req, res);
});

/**
 * @route PUT /api/keys/:keyId
 * @desc Update an API key's properties
 * @access Private (requires JWT authentication)
 */
router.put('/:keyId', async (req, res) => {
  await apiKeyController.updateApiKey(req, res);
});

/**
 * @route DELETE /api/keys/:keyId
 * @desc Revoke (deactivate) an API key
 * @access Private (requires JWT authentication)
 */
router.delete('/:keyId', async (req, res) => {
  await apiKeyController.revokeApiKey(req, res);
});

/**
 * @route GET /api/keys/:keyId/usage
 * @desc Get API key usage statistics
 * @access Private (requires JWT authentication)
 */
router.get('/:keyId/usage', async (req, res) => {
  await apiKeyController.getApiKeyUsage(req, res);
});

/**
 * @route POST /api/keys/:keyId/regenerate
 * @desc Regenerate an API key (creates new secret)
 * @access Private (requires JWT authentication)
 */
router.post('/:keyId/regenerate', async (req, res) => {
  await apiKeyController.regenerateApiKey(req, res);
});

export default router;
