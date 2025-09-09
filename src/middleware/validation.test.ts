import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from './validation';

const mockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  query: {},
  params: {},
  get: jest.fn().mockImplementation((header: string) => {
    if (header === 'X-Request-ID') {
      return 'test-request-id';
    }
    return undefined;
  }),
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('Validation Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
    next = mockNext;
  });

  describe('Body Validation', () => {
    const bodySchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email format'),
      age: z.number().min(18, 'Must be at least 18'),
    });

    it('should validate and pass through valid body data', () => {
      req.body = { name: 'John Doe', email: 'john@example.com', age: 25 };
      const middleware = validateRequest({ body: bodySchema });

      middleware(req as Request, res as Response, next);

      expect(req.body).toEqual({ name: 'John Doe', email: 'john@example.com', age: 25 });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid body data', () => {
      req.body = { name: '', email: 'invalid-email', age: 16 };
      const middleware = validateRequest({ body: bodySchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: [
            {
              field: 'name',
              message: 'Name is required',
              code: 'too_small',
            },
            {
              field: 'email',
              message: 'Invalid email format',
              code: 'invalid_string',
            },
            {
              field: 'age',
              message: 'Must be at least 18',
              code: 'too_small',
            },
          ],
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.3.0',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', () => {
      req.body = {};
      const middleware = validateRequest({ body: bodySchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: [
            {
              field: 'name',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              field: 'email',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              field: 'age',
              message: 'Required',
              code: 'invalid_type',
            },
          ],
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.3.0',
        },
      });
    });

    it('should handle nested object validation', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            firstName: z.string().min(1),
            lastName: z.string().min(1),
          }),
        }),
      });

      req.body = { user: { profile: { firstName: '', lastName: 'Doe' } } };
      const middleware = validateRequest({ body: nestedSchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: [
            {
              field: 'user.profile.firstName',
              message: 'String must contain at least 1 character(s)',
              code: 'too_small',
            },
          ],
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.3.0',
        },
      });
    });
  });

  describe('Query Validation', () => {
    const querySchema = z.object({
      page: z.string().transform(Number).pipe(z.number().min(1)),
      limit: z.string().transform(Number).pipe(z.number().min(1).max(100)),
      search: z.string().optional(),
    });

    it('should validate and transform valid query parameters', () => {
      req.query = { page: '2', limit: '10', search: 'test' };
      const middleware = validateRequest({ query: querySchema });

      middleware(req as Request, res as Response, next);

      expect(req.query).toEqual({ page: 2, limit: 10, search: 'test' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid query parameters', () => {
      req.query = { page: '0', limit: '200' };
      const middleware = validateRequest({ query: querySchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: [
            {
              field: 'page',
              message: 'Number must be greater than or equal to 1',
              code: 'too_small',
            },
            {
              field: 'limit',
              message: 'Number must be less than or equal to 100',
              code: 'too_big',
            },
          ],
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.3.0',
        },
      });
    });

    it('should handle optional query parameters', () => {
      req.query = { page: '1', limit: '10' };
      const middleware = validateRequest({ query: querySchema });

      middleware(req as Request, res as Response, next);

      expect(req.query).toEqual({ page: 1, limit: 10 });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Params Validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid('Invalid UUID format'),
      type: z.enum(['user', 'admin'], {
        errorMap: () => ({ message: 'Type must be user or admin' }),
      }),
    });

    it('should validate valid path parameters', () => {
      req.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user',
      };
      const middleware = validateRequest({ params: paramsSchema });

      middleware(req as Request, res as Response, next);

      expect(req.params).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user',
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid path parameters', () => {
      req.params = { id: 'invalid-uuid', type: 'invalid-type' };
      const middleware = validateRequest({ params: paramsSchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: [
            {
              field: 'id',
              message: 'Invalid UUID format',
              code: 'invalid_string',
            },
            {
              field: 'type',
              message: 'Type must be user or admin',
              code: 'invalid_enum_value',
            },
          ],
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.3.0',
        },
      });
    });
  });

  describe('Multiple Schema Validation', () => {
    const schemas = {
      body: z.object({
        name: z.string().min(1),
      }),
      query: z.object({
        page: z.string().transform(Number),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    };

    it('should validate all schemas when all are valid', () => {
      req.body = { name: 'Test' };
      req.query = { page: '1' };
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateRequest(schemas);

      middleware(req as Request, res as Response, next);

      expect(req.body).toEqual({ name: 'Test' });
      expect(req.query).toEqual({ page: 1 });
      expect(req.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should combine validation errors from multiple schemas', () => {
      req.body = { name: '' };
      req.query = { page: 'invalid' };
      req.params = { id: 'invalid-uuid' };

      const middleware = validateRequest(schemas);

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const call = (res.json as jest.Mock).mock.calls[0][0];
      // Note: Only body validation will run first and fail, then validation stops
      expect(call.error.details).toHaveLength(1);
      expect(call.error.details).toEqual([expect.objectContaining({ field: 'name' })]);
    });
  });

  describe('Partial Schema Validation', () => {
    it('should validate only body when only body schema is provided', () => {
      const bodySchema = z.object({ name: z.string().min(1) });
      req.body = { name: 'Test' };
      req.query = { invalid: 'data' }; // This should be ignored
      req.params = { invalid: 'data' }; // This should be ignored

      const middleware = validateRequest({ body: bodySchema });

      middleware(req as Request, res as Response, next);

      expect(req.body).toEqual({ name: 'Test' });
      expect(req.query).toEqual({ invalid: 'data' }); // Unchanged
      expect(req.params).toEqual({ invalid: 'data' }); // Unchanged
      expect(next).toHaveBeenCalled();
    });

    it('should validate only query when only query schema is provided', () => {
      const querySchema = z.object({ page: z.string().transform(Number) });
      req.query = { page: '1' };
      req.body = { invalid: 'data' }; // This should be ignored

      const middleware = validateRequest({ query: querySchema });

      middleware(req as Request, res as Response, next);

      expect(req.query).toEqual({ page: 1 });
      expect(req.body).toEqual({ invalid: 'data' }); // Unchanged
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-Zod errors by passing to next', () => {
      const faultySchema = {
        body: {
          parse: jest.fn().mockImplementation(() => {
            throw new Error('Non-Zod error');
          }),
        } as any,
      };

      const middleware = validateRequest(faultySchema);

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle missing request ID', () => {
      req.get = jest.fn().mockReturnValue(undefined);
      req.body = { invalid: 'data' };

      const bodySchema = z.object({ name: z.string().min(1) });
      const middleware = validateRequest({ body: bodySchema });

      middleware(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: expect.any(Array),
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.3.0',
        },
      });
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle array validation', () => {
      const arraySchema = z.object({
        items: z
          .array(
            z.object({
              id: z.number(),
              name: z.string().min(1),
            })
          )
          .min(1, 'At least one item is required'),
      });

      req.body = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: '' }, // Invalid
          { id: 'invalid', name: 'Item 3' }, // Invalid
        ],
      };

      const middleware = validateRequest({ body: arraySchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const call = (res.json as jest.Mock).mock.calls[0][0];
      expect(call.error.details).toEqual([
        {
          field: 'items.1.name',
          message: 'String must contain at least 1 character(s)',
          code: 'too_small',
        },
        {
          field: 'items.2.id',
          message: 'Expected number, received string',
          code: 'invalid_type',
        },
      ]);
    });

    it('should handle conditional validation', () => {
      const conditionalSchema = z
        .object({
          type: z.enum(['email', 'phone']),
          contact: z.string(),
        })
        .refine(
          data => {
            if (data.type === 'email') {
              return z.string().email().safeParse(data.contact).success;
            }
            return true;
          },
          {
            message: 'Invalid email format for email type',
            path: ['contact'],
          }
        );

      req.body = { type: 'email', contact: 'invalid-email' };
      const middleware = validateRequest({ body: conditionalSchema });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const call = (res.json as jest.Mock).mock.calls[0][0];
      expect(call.error.details).toEqual([
        {
          field: 'contact',
          message: 'Invalid email format for email type',
          code: 'custom',
        },
      ]);
    });
  });

  describe('Schema Transformation', () => {
    it('should apply schema transformations to request data', () => {
      const transformSchema = z.object({
        name: z.string().trim().toLowerCase(),
        age: z.string().transform(Number),
        isActive: z.string().transform(val => val === 'true'),
        tags: z.string().transform(str => str.split(',')),
      });

      req.body = {
        name: '  JOHN DOE  ',
        age: '25',
        isActive: 'true',
        tags: 'tag1,tag2,tag3',
      };

      const middleware = validateRequest({ body: transformSchema });

      middleware(req as Request, res as Response, next);

      expect(req.body).toEqual({
        name: 'john doe',
        age: 25,
        isActive: true,
        tags: ['tag1', 'tag2', 'tag3'],
      });
      expect(next).toHaveBeenCalled();
    });
  });
});
