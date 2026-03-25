import { NextResponse } from 'next/server';
import {
  AuthenticationError,
  ShopContextError
} from '@/lib/auth/get-active-shop';
import { AuthorizationError } from '@/lib/authz';

export function apiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof ShopContextError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  console.error(error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
