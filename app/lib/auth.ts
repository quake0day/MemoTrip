import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export async function createUser(email: string, password: string, name?: string) {
  const hashedPassword = await hashPassword(password);
  return await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  });
}

export async function createUserWithRandomPassword(email: string, name?: string) {
  const randomPassword = crypto.randomBytes(12).toString('hex');
  return await createUser(email, randomPassword, name);
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  // Don't return password
  const { password: _password, ...userWithoutPassword } = user;
  void _password;
  return userWithoutPassword;
}
