import jwt from 'jsonwebtoken';

const accessSecret = () => process.env.JWT_SECRET || 'your-secret-key-change-this';
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-this';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      familyId: user.familyId,
      role: user.role,
    },
    accessSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      familyId: user.familyId,
    },
    refreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, accessSecret());
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, refreshSecret());
  } catch {
    return null;
  }
};
