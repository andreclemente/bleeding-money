export interface PublicOwner { id: string, name: string, email: string }
export interface StoredOwner extends PublicOwner { passwordHash: string, createdAt: string, legacyClaimedAt?: string }
export interface StoredSession { id: string, userId: string, tokenHash: string, createdAt: string, expiresAt: string, revokedAt?: string }
export interface RegisterInput { name: string, email: string, password: string }
export interface LoginInput { email: string, password: string }

export interface AuthRepository {
  getOwner(): Promise<StoredOwner | null>
  registerOwner(owner: StoredOwner, session: StoredSession, legacyUserId: string): Promise<void>
  replaceSessions(session: StoredSession): Promise<void>
  getSession(tokenHash: string): Promise<{ owner: StoredOwner, session: StoredSession } | null>
  revokeSession(tokenHash: string, revokedAt: string): Promise<void>
  claimLegacyExpenses(ownerId: string, legacyUserId: string, claimedAt: string): Promise<void>
}
