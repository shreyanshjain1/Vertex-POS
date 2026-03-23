import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/auth/validation';
import { verifyPassword } from '@/lib/auth/password';
import { ShopRole } from '@prisma/client';

function normalizeRole(value: unknown): ShopRole {
  if (value === 'ADMIN' || value === 'MANAGER' || value === 'CASHIER') {
    return value;
  }
  return 'CASHIER';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            memberships: {
              include: { shop: true },
              orderBy: { createdAt: 'asc' },
              take: 1
            }
          }
        });

        if (!user) return null;
        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        const primary = user.memberships.find((m) => m.shopId === user.defaultShopId) ?? user.memberships[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email.split('@')[0],
          role: normalizeRole(primary?.role),
          defaultShopId: user.defaultShopId ?? primary?.shopId ?? null
        };
      }
    })
  ],
  callbacks: {
    async authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isPublicRoute = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/onboard' || pathname.startsWith('/api/auth');
      return isPublicRoute ? true : !!auth;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = normalizeRole((user as { role?: unknown }).role);
        token.defaultShopId = (user as { defaultShopId?: string | null }).defaultShopId ?? null;
      }
      if (trigger === 'update' && session?.user) {
        token.role = normalizeRole(session.user.role);
        token.defaultShopId = session.user.defaultShopId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub ?? '');
        session.user.role = normalizeRole(token.role);
        session.user.defaultShopId = typeof token.defaultShopId === 'string' ? token.defaultShopId : null;
      }
      return session;
    }
  }
});
