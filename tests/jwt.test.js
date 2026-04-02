import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/utils/jwt.js';

describe('jwt utils', () => {
  const prevAccess = process.env.JWT_SECRET;
  const prevRefresh = process.env.JWT_REFRESH_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'vitest-access-secret-min-32-chars!!';
    process.env.JWT_REFRESH_SECRET = 'vitest-refresh-secret-min-32-chars!';
  });

  afterEach(() => {
    process.env.JWT_SECRET = prevAccess;
    process.env.JWT_REFRESH_SECRET = prevRefresh;
  });

  const user = {
    id: 'u1',
    email: 'a@b.com',
    familyId: 'f1',
    role: 'ADMIN',
  };

  it('genera e verifica access token', () => {
    const token = generateAccessToken(user);
    const payload = verifyAccessToken(token);
    expect(payload).toMatchObject({
      id: user.id,
      email: user.email,
      familyId: user.familyId,
      role: user.role,
    });
  });

  it('genera e verifica refresh token', () => {
    const token = generateRefreshToken(user);
    const payload = verifyRefreshToken(token);
    expect(payload).toMatchObject({
      id: user.id,
      email: user.email,
      familyId: user.familyId,
    });
    expect(payload.role).toBeUndefined();
  });

  it('token invalido ritorna null', () => {
    expect(verifyAccessToken('not-a-jwt')).toBeNull();
    expect(verifyRefreshToken('x.y.z')).toBeNull();
  });
});
