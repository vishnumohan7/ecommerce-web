import { NextRequest, NextResponse } from 'next/server';
import { ageGateCookie } from '../../../lib/age-gate';

export function POST(request: NextRequest) {
  const origin = `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`;
  const response = NextResponse.redirect(new URL('/?ageGate=declined', origin), 303);
  response.cookies.delete(ageGateCookie);
  return response;
}
