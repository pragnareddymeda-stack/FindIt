import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function signToken(userId) {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: '7d',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}
