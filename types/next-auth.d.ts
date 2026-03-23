import 'next-auth';
import 'next-auth/jwt';
import { ShopRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: ShopRole;
      defaultShopId: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: ShopRole;
    defaultShopId: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: ShopRole;
    defaultShopId?: string | null;
  }
}
