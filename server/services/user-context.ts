export interface UserContext { userId: string }
export const devUserContext = (): UserContext => ({ userId: process.env.DEV_USER_ID || '00000000-0000-4000-8000-000000000001' })
