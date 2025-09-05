---
title: UserService Documentation
description: Complete technical documentation for UserService - User account management, authentication, and profile operations in Altus 4.
---

# UserService Documentation

Comprehensive UserService Implementation Guide

The UserService manages user accounts, authentication, and profile operations. It provides secure user registration, login functionality, password management, and user profile maintenance with comprehensive security measures and audit logging.

## Service Overview

### Responsibilities

The UserService handles:

- **User Registration** - Secure user account creation with validation and verification
- **Authentication** - Password-based login with security measures
- **Profile Management** - User profile updates, preferences, and account settings
- **Password Security** - Secure password hashing, validation, and reset functionality
- **Account Lifecycle** - Account activation, deactivation, and deletion
- **Audit Logging** - Comprehensive logging of user actions for security and compliance

### Architecture

```typescript
export class UserService {
  constructor(
    private databaseService: DatabaseService,
    private encryptionService: EncryptionService,
    private logger: Logger,
    private config: UserConfig
  ) {}

  // Core User Methods
  async createUser(userData: CreateUserRequest): Promise<User>;
  async getUserById(userId: string): Promise<User | null>;
  async getUserByEmail(email: string): Promise<User | null>;
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User>;
  async deleteUser(userId: string): Promise<void>;

  // Authentication Methods
  async authenticateUser(email: string, password: string): Promise<AuthResult>;
  async hashPassword(password: string): Promise<string>;
  async validatePassword(password: string, hash: string): Promise<boolean>;
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;

  // Profile Management
  async updateProfile(userId: string, profile: UserProfile): Promise<void>;
  async getProfile(userId: string): Promise<UserProfile | null>;
  async updatePreferences(userId: string, preferences: UserPreferences): Promise<void>;

  // Security Methods
  async lockAccount(userId: string, reason: string): Promise<void>;
  async unlockAccount(userId: string): Promise<void>;
  async logSecurityEvent(userId: string, event: SecurityEvent): Promise<void>;
}
```

## Core Functionality

### User Registration and Management

#### User Account Creation

The service provides secure user registration with comprehensive validation:

```typescript
interface CreateUserRequest {
  email: string
  password: string
  name: string
  company?: string
  role?: UserRole
  metadata?: UserMetadata
}

interface User {
  id: string
  email: string
  name: string
  company?: string
  role: UserRole
  status: UserStatus
  profile: UserProfile
  preferences: UserPreferences
  security: UserSecurity
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

interface UserRole {
  name: 'admin' | 'user' | 'viewer'
  permissions: Permission[]
}

interface UserStatus {
  active: boolean
  verified: boolean
  locked: boolean
  lockReason?: string
  lockedAt?: Date
}

interface UserSecurity {
  passwordHash: string
  passwordChangedAt: Date
  failedLoginAttempts: number
  lastFailedLoginAt?: Date
  twoFactorEnabled: boolean
  recoveryTokens?: string[]
}

async createUser(userData: CreateUserRequest): Promise<User> {
  const startTime = Date.now()

  try {
    // Validate user data
    await this.validateUserData(userData)

    // Check if user already exists
    const existingUser = await this.getUserByEmail(userData.email)
    if (existingUser) {
      throw new AppError('USER_ALREADY_EXISTS', 'User with this email already exists')
    }

    // Hash password securely
    const passwordHash = await this.hashPassword(userData.password)

    // Generate user ID
    const userId = this.generateUserId()

    // Create user object
    const user: User = {
      id: userId,
      email: userData.email.toLowerCase().trim(),
      name: userData.name.trim(),
      company: userData.company?.trim(),
      role: userData.role || { name: 'user', permissions: this.getDefaultPermissions() },
      status: {
        active: true,
        verified: false,
        locked: false
      },
      profile: {
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        company: userData.company?.trim(),
        avatar: null,
        bio: null,
        location: null,
        website: null
      },
      preferences: this.getDefaultPreferences(),
      security: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        twoFactorEnabled: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save user to database
    await this.saveUser(user)

    // Log user creation event
    await this.logSecurityEvent(userId, {
      type: 'user_created',
      description: 'User account created',
      metadata: {
        email: userData.email,
        registrationSource: userData.metadata?.source || 'web'
      }
    })

    const operationTime = Date.now() - startTime
    this.logger.info('User created successfully', {
      userId,
      email: userData.email,
      operationTime
    })

    return user

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.logger.error('User creation failed', {
      error,
      email: userData.email,
      operationTime
    })
    throw error
  }
}

private async validateUserData(userData: CreateUserRequest): Promise<void> {
  const errors: string[] = []

  // Email validation
  if (!userData.email || !this.isValidEmail(userData.email)) {
    errors.push('Invalid email address')
  }

  // Password validation
  const passwordValidation = this.validatePasswordStrength(userData.password)
  if (!passwordValidation.valid) {
    errors.push(...passwordValidation.errors)
  }

  // Name validation
  if (!userData.name || userData.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters')
  }

  if (userData.name.trim().length > 100) {
    errors.push('Name must be less than 100 characters')
  }

  // Company validation (if provided)
  if (userData.company && userData.company.trim().length > 100) {
    errors.push('Company name must be less than 100 characters')
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', `Validation failed: ${errors.join(', ')}`)
  }
}

private isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

private validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!password) {
    return { valid: false, errors: ['Password is required'] }
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // Check for common passwords
  if (this.isCommonPassword(password)) {
    errors.push('Password is too common, please choose a more unique password')
  }

  return { valid: errors.length === 0, errors }
}
```

### Authentication and Security

#### Secure Authentication Implementation

The service provides robust authentication with security measures:

```typescript
interface AuthResult {
  success: boolean
  user?: User
  token?: string
  refreshToken?: string
  expiresIn?: number
  reason?: string
  requiresTwoFactor?: boolean
  lockoutRemaining?: number
}

interface SecurityEvent {
  type: SecurityEventType
  description: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  timestamp?: Date
}

enum SecurityEventType {
  USER_CREATED = 'user_created',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  PROFILE_UPDATED = 'profile_updated',
  PERMISSIONS_CHANGED = 'permissions_changed'
}

async authenticateUser(email: string, password: string, metadata?: AuthMetadata): Promise<AuthResult> {
  const startTime = Date.now()

  try {
    // Get user by email
    const user = await this.getUserByEmail(email)
    if (!user) {
      await this.logFailedLogin(email, 'user_not_found', metadata)
      return {
        success: false,
        reason: 'Invalid email or password'
      }
    }

    // Check account status
    if (!user.status.active) {
      await this.logFailedLogin(email, 'account_inactive', metadata)
      return {
        success: false,
        reason: 'Account is inactive'
      }
    }

    if (user.status.locked) {
      await this.logFailedLogin(email, 'account_locked', metadata)
      return {
        success: false,
        reason: 'Account is locked',
        lockoutRemaining: this.calculateLockoutRemaining(user)
      }
    }

    // Check for rate limiting
    if (await this.isRateLimited(user.id, metadata?.ipAddress)) {
      await this.logFailedLogin(email, 'rate_limited', metadata)
      return {
        success: false,
        reason: 'Too many login attempts, please try again later'
      }
    }

    // Validate password
    const validPassword = await this.validatePassword(password, user.security.passwordHash)
    if (!validPassword) {
      await this.handleFailedLogin(user, metadata)
      return {
        success: false,
        reason: 'Invalid email or password'
      }
    }

    // Check if two-factor authentication is required
    if (user.security.twoFactorEnabled) {
      return {
        success: false,
        requiresTwoFactor: true,
        reason: 'Two-factor authentication required'
      }
    }

    // Successful authentication
    await this.handleSuccessfulLogin(user, metadata)

    const operationTime = Date.now() - startTime
    this.logger.info('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      operationTime
    })

    return {
      success: true,
      user: this.sanitizeUserForResponse(user)
    }

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.logger.error('Authentication failed', {
      error,
      email,
      operationTime
    })

    return {
      success: false,
      reason: 'Authentication service error'
    }
  }
}

async hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = this.config.security.bcryptRounds || 12
    const hash = await bcrypt.hash(password, saltRounds)

    this.logger.debug('Password hashed successfully', {
      saltRounds,
      hashLength: hash.length
    })

    return hash

  } catch (error) {
    this.logger.error('Password hashing failed', { error })
    throw new AppError('PASSWORD_HASH_FAILED', 'Failed to hash password')
  }
}

async validatePassword(password: string, hash: string): Promise<boolean> {
  try {
    const isValid = await bcrypt.compare(password, hash)

    this.logger.debug('Password validation completed', {
      isValid,
      hashLength: hash.length
    })

    return isValid

  } catch (error) {
    this.logger.error('Password validation failed', { error })
    return false
  }
}

private async handleFailedLogin(user: User, metadata?: AuthMetadata): Promise<void> {
  // Increment failed login attempts
  user.security.failedLoginAttempts += 1
  user.security.lastFailedLoginAt = new Date()

  // Lock account if too many failed attempts
  const maxAttempts = this.config.security.maxFailedLoginAttempts || 5
  if (user.security.failedLoginAttempts >= maxAttempts) {
    await this.lockAccount(user.id, 'Too many failed login attempts')
  }

  // Update user security info
  await this.updateUserSecurity(user.id, user.security)

  // Log security event
  await this.logSecurityEvent(user.id, {
    type: SecurityEventType.LOGIN_FAILED,
    description: 'Failed login attempt',
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
    metadata: {
      failedAttempts: user.security.failedLoginAttempts,
      locked: user.security.failedLoginAttempts >= maxAttempts
    }
  })
}

private async handleSuccessfulLogin(user: User, metadata?: AuthMetadata): Promise<void> {
  // Reset failed login attempts
  user.security.failedLoginAttempts = 0
  user.security.lastFailedLoginAt = undefined
  user.lastLoginAt = new Date()

  // Update user info
  await this.updateUser(user.id, {
    lastLoginAt: user.lastLoginAt,
    security: user.security
  })

  // Log security event
  await this.logSecurityEvent(user.id, {
    type: SecurityEventType.LOGIN_SUCCESS,
    description: 'Successful login',
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent
  })
}
```

### Profile Management

#### User Profile and Preferences Management

The service provides comprehensive profile management capabilities:

```typescript
interface UserProfile {
  name: string
  email: string
  company?: string
  avatar?: string
  bio?: string
  location?: string
  website?: string
  socialLinks?: SocialLinks
}

interface SocialLinks {
  twitter?: string
  linkedin?: string
  github?: string
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  notifications: NotificationPreferences
  privacy: PrivacyPreferences
  search: SearchPreferences
}

interface NotificationPreferences {
  email: {
    loginAlerts: boolean
    securityUpdates: boolean
    productUpdates: boolean
    marketingEmails: boolean
  }
  inApp: {
    searchNotifications: boolean
    systemAlerts: boolean
    tips: boolean
  }
}

interface SearchPreferences {
  defaultSearchMode: 'natural' | 'boolean' | 'semantic'
  preferredDatabases: string[]
  resultLimit: number
  enableCache: boolean
  saveSearchHistory: boolean
}

async updateProfile(userId: string, profileData: Partial<UserProfile>): Promise<void> {
  const startTime = Date.now()

  try {
    // Get current user
    const user = await this.getUserById(userId)
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found')
    }

    // Validate profile data
    await this.validateProfileData(profileData)

    // Update profile
    const updatedProfile: UserProfile = {
      ...user.profile,
      ...profileData,
      // Ensure email changes go through proper verification
      email: user.profile.email // Don't allow direct email changes
    }

    // Handle special cases
    if (profileData.avatar) {
      updatedProfile.avatar = await this.processAvatarUpload(profileData.avatar)
    }

    if (profileData.website) {
      updatedProfile.website = this.normalizeUrl(profileData.website)
    }

    // Update user in database
    await this.updateUser(userId, { profile: updatedProfile })

    // Log profile update
    await this.logSecurityEvent(userId, {
      type: SecurityEventType.PROFILE_UPDATED,
      description: 'User profile updated',
      metadata: {
        updatedFields: Object.keys(profileData)
      }
    })

    const operationTime = Date.now() - startTime
    this.logger.info('Profile updated successfully', {
      userId,
      updatedFields: Object.keys(profileData),
      operationTime
    })

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.logger.error('Profile update failed', {
      error,
      userId,
      operationTime
    })
    throw error
  }
}

async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
  try {
    // Get current user
    const user = await this.getUserById(userId)
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found')
    }

    // Validate preferences
    await this.validatePreferences(preferences)

    // Deep merge preferences
    const updatedPreferences: UserPreferences = this.deepMerge(user.preferences, preferences)

    // Update user preferences
    await this.updateUser(userId, { preferences: updatedPreferences })

    this.logger.info('User preferences updated', {
      userId,
      updatedPreferences: Object.keys(preferences)
    })

  } catch (error) {
    this.logger.error('Preferences update failed', { error, userId })
    throw error
  }
}

private async validateProfileData(profileData: Partial<UserProfile>): Promise<void> {
  const errors: string[] = []

  if (profileData.name !== undefined) {
    if (!profileData.name || profileData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters')
    }
    if (profileData.name.trim().length > 100) {
      errors.push('Name must be less than 100 characters')
    }
  }

  if (profileData.bio !== undefined && profileData.bio.length > 500) {
    errors.push('Bio must be less than 500 characters')
  }

  if (profileData.website !== undefined && profileData.website) {
    if (!this.isValidUrl(profileData.website)) {
      errors.push('Invalid website URL')
    }
  }

  if (profileData.location !== undefined && profileData.location.length > 100) {
    errors.push('Location must be less than 100 characters')
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', `Profile validation failed: ${errors.join(', ')}`)
  }
}

private getDefaultPreferences(): UserPreferences {
  return {
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    notifications: {
      email: {
        loginAlerts: true,
        securityUpdates: true,
        productUpdates: true,
        marketingEmails: false
      },
      inApp: {
        searchNotifications: true,
        systemAlerts: true,
        tips: true
      }
    },
    privacy: {
      shareAnalytics: true,
      shareUsageData: false,
      allowPersonalization: true
    },
    search: {
      defaultSearchMode: 'natural',
      preferredDatabases: [],
      resultLimit: 20,
      enableCache: true,
      saveSearchHistory: true
    }
  }
}
```

### Security and Account Management

#### Account Security and Lifecycle Management

The service provides comprehensive security and account lifecycle management:

```typescript
interface SecurityConfig {
  maxFailedLoginAttempts: number
  accountLockoutDuration: number
  passwordMinLength: number
  passwordMaxAge: number
  sessionTimeout: number
  bcryptRounds: number
}

interface AccountLockInfo {
  locked: boolean
  lockReason?: string
  lockedAt?: Date
  lockExpiration?: Date
  canUnlock: boolean
}

async lockAccount(userId: string, reason: string, duration?: number): Promise<void> {
  try {
    const user = await this.getUserById(userId)
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found')
    }

    const lockDuration = duration || this.config.security.accountLockoutDuration || 1800000 // 30 minutes
    const lockExpiration = new Date(Date.now() + lockDuration)

    // Update user status
    user.status.locked = true
    user.status.lockReason = reason
    user.status.lockedAt = new Date()

    await this.updateUser(userId, { status: user.status })

    // Schedule automatic unlock if duration is specified
    if (lockDuration > 0) {
      setTimeout(async () => {
        try {
          await this.unlockAccount(userId)
        } catch (error) {
          this.logger.error('Auto-unlock failed', { error, userId })
        }
      }, lockDuration)
    }

    // Log security event
    await this.logSecurityEvent(userId, {
      type: SecurityEventType.ACCOUNT_LOCKED,
      description: `Account locked: ${reason}`,
      metadata: {
        lockDuration,
        lockExpiration: lockExpiration.toISOString()
      }
    })

    this.logger.warn('Account locked', {
      userId,
      reason,
      lockDuration,
      lockExpiration
    })

  } catch (error) {
    this.logger.error('Failed to lock account', { error, userId, reason })
    throw error
  }
}

async unlockAccount(userId: string): Promise<void> {
  try {
    const user = await this.getUserById(userId)
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found')
    }

    if (!user.status.locked) {
      return // Already unlocked
    }

    // Reset security status
    user.status.locked = false
    user.status.lockReason = undefined
    user.status.lockedAt = undefined
    user.security.failedLoginAttempts = 0
    user.security.lastFailedLoginAt = undefined

    await this.updateUser(userId, {
      status: user.status,
      security: user.security
    })

    // Log security event
    await this.logSecurityEvent(userId, {
      type: SecurityEventType.ACCOUNT_UNLOCKED,
      description: 'Account unlocked'
    })

    this.logger.info('Account unlocked', { userId })

  } catch (error) {
    this.logger.error('Failed to unlock account', { error, userId })
    throw error
  }
}

async changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  try {
    const user = await this.getUserById(userId)
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found')
    }

    // Verify current password
    const validPassword = await this.validatePassword(currentPassword, user.security.passwordHash)
    if (!validPassword) {
      await this.logSecurityEvent(userId, {
        type: SecurityEventType.PASSWORD_CHANGED,
        description: 'Password change failed - invalid current password'
      })
      throw new AppError('INVALID_PASSWORD', 'Current password is incorrect')
    }

    // Validate new password
    const passwordValidation = this.validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      throw new AppError('VALIDATION_ERROR', `Password validation failed: ${passwordValidation.errors.join(', ')}`)
    }

    // Check password history (prevent reuse)
    if (await this.isPasswordReused(userId, newPassword)) {
      throw new AppError('PASSWORD_REUSED', 'Cannot reuse recent passwords')
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword)

    // Update user security
    user.security.passwordHash = newPasswordHash
    user.security.passwordChangedAt = new Date()
    user.security.failedLoginAttempts = 0

    await this.updateUser(userId, { security: user.security })

    // Store password in history for reuse prevention
    await this.addPasswordToHistory(userId, newPasswordHash)

    // Log security event
    await this.logSecurityEvent(userId, {
      type: SecurityEventType.PASSWORD_CHANGED,
      description: 'Password changed successfully'
    })

    this.logger.info('Password changed successfully', { userId })

  } catch (error) {
    this.logger.error('Password change failed', { error, userId })
    throw error
  }
}

async deleteUser(userId: string, reason?: string): Promise<void> {
  try {
    const user = await this.getUserById(userId)
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found')
    }

    // Soft delete - mark as inactive and anonymize sensitive data
    const deletedUser = {
      ...user,
      email: `deleted_${userId}@example.com`,
      name: 'Deleted User',
      status: {
        ...user.status,
        active: false
      },
      profile: {
        ...user.profile,
        email: `deleted_${userId}@example.com`,
        name: 'Deleted User',
        bio: null,
        location: null,
        website: null,
        avatar: null
      }
    }

    await this.updateUser(userId, deletedUser)

    // Log deletion event
    await this.logSecurityEvent(userId, {
      type: 'user_deleted',
      description: `User account deleted: ${reason || 'User request'}`,
      metadata: { reason }
    })

    this.logger.info('User deleted', { userId, reason })

  } catch (error) {
    this.logger.error('User deletion failed', { error, userId })
    throw error
  }
}
```

### Security Event Logging

#### Comprehensive Security Audit Trail

The service provides detailed security event logging for audit and monitoring:

```typescript
interface SecurityEvent {
  id: string
  userId: string
  type: SecurityEventType
  description: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
}

async logSecurityEvent(userId: string, event: Omit<SecurityEvent, 'id' | 'userId' | 'timestamp' | 'severity'>): Promise<void> {
  try {
    const securityEvent: SecurityEvent = {
      id: this.generateEventId(),
      userId,
      type: event.type,
      description: event.description,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata,
      timestamp: event.timestamp || new Date(),
      severity: this.determineSeverity(event.type)
    }

    // Store in database
    await this.storeSecurityEvent(securityEvent)

    // Alert on high/critical events
    if (securityEvent.severity === 'high' || securityEvent.severity === 'critical') {
      await this.alertSecurityTeam(securityEvent)
    }

    this.logger.info('Security event logged', {
      eventId: securityEvent.id,
      userId,
      type: event.type,
      severity: securityEvent.severity
    })

  } catch (error) {
    this.logger.error('Failed to log security event', { error, userId, eventType: event.type })
  }
}

private determineSeverity(eventType: SecurityEventType): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<SecurityEventType, 'low' | 'medium' | 'high' | 'critical'> = {
    [SecurityEventType.USER_CREATED]: 'low',
    [SecurityEventType.LOGIN_SUCCESS]: 'low',
    [SecurityEventType.LOGIN_FAILED]: 'medium',
    [SecurityEventType.PASSWORD_CHANGED]: 'medium',
    [SecurityEventType.ACCOUNT_LOCKED]: 'high',
    [SecurityEventType.ACCOUNT_UNLOCKED]: 'medium',
    [SecurityEventType.PROFILE_UPDATED]: 'low',
    [SecurityEventType.PERMISSIONS_CHANGED]: 'high'
  }

  return severityMap[eventType] || 'medium'
}

async getSecurityEvents(
  userId: string,
  options: {
    limit?: number
    offset?: number
    eventTypes?: SecurityEventType[]
    dateRange?: { from: Date; to: Date }
    severity?: ('low' | 'medium' | 'high' | 'critical')[]
  } = {}
): Promise<{ events: SecurityEvent[]; total: number }> {
  try {
    const query = this.buildSecurityEventQuery(userId, options)
    const events = await this.querySecurityEvents(query)
    const total = await this.countSecurityEvents(query)

    return { events, total }

  } catch (error) {
    this.logger.error('Failed to get security events', { error, userId })
    throw new AppError('SECURITY_EVENTS_RETRIEVAL_FAILED', error.message)
  }
}
```

## Testing and Validation

### Unit Testing

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
      transaction: jest.fn(),
    };

    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    userService = new UserService(
      mockDatabaseService,
      mockEncryptionService,
      mockLogger,
      testConfig
    );
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData: CreateUserRequest = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      mockDatabaseService.query.mockResolvedValue([]);

      const user = await userService.createUser(userData);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe(userData.email.toLowerCase());
      expect(user.name).toBe(userData.name);
      expect(user.status.active).toBe(true);
    });

    it('should throw error for duplicate email', async () => {
      const userData: CreateUserRequest = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      mockDatabaseService.query.mockResolvedValue([{ id: 'existing-user' }]);

      await expect(userService.createUser(userData)).rejects.toThrow('USER_ALREADY_EXISTS');
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid credentials', async () => {
      const mockUser = createMockUser();
      mockDatabaseService.query.mockResolvedValue([mockUser]);
      jest.spyOn(userService, 'validatePassword').mockResolvedValue(true);

      const result = await userService.authenticateUser('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should fail authentication for invalid password', async () => {
      const mockUser = createMockUser();
      mockDatabaseService.query.mockResolvedValue([mockUser]);
      jest.spyOn(userService, 'validatePassword').mockResolvedValue(false);

      const result = await userService.authenticateUser('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid email or password');
    });
  });
});
```

## Configuration and Best Practices

### Security Configuration

```typescript
interface UserConfig {
  security: {
    bcryptRounds: number;
    maxFailedLoginAttempts: number;
    accountLockoutDuration: number;
    passwordMinLength: number;
    passwordMaxAge: number;
    sessionTimeout: number;
    requireEmailVerification: boolean;
    enableTwoFactor: boolean;
  };
  validation: {
    allowedEmailDomains?: string[];
    blockedEmailDomains?: string[];
    requireStrongPasswords: boolean;
    allowPasswordReset: boolean;
  };
  features: {
    enableRegistration: boolean;
    enableProfileUpdates: boolean;
    enableAccountDeletion: boolean;
    enableSecurityLogging: boolean;
  };
}
```

### Best Practices

1. **Password Security**: Use strong hashing (bcrypt) with appropriate salt rounds
2. **Input Validation**: Validate and sanitize all user inputs
3. **Rate Limiting**: Implement login attempt rate limiting
4. **Security Logging**: Log all security-relevant events
5. **Account Lockout**: Implement progressive account lockout policies
6. **Data Privacy**: Follow data protection regulations (GDPR, CCPA)
7. **Session Management**: Implement secure session handling

---

**The UserService provides secure and comprehensive user account management, forming the foundation for authentication and user experience in Altus 4.**
