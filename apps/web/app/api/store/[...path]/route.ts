import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '../../../../lib/store-api';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${API_BASE}/${path.join('/')}${request.nextUrl.search}`;
  try {
    const init: RequestInit = {
      method: request.method,
      headers: forwardedHeaders(request),
      cache: 'no-store',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.text();
    const upstream = await fetch(target, init);
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) response.headers.set('set-cookie', cookie);
    return response;
  } catch {
    return NextResponse.json({ message: 'The commerce API is temporarily unavailable.' }, { status: 503 });
  }
}

function forwardedHeaders(request: NextRequest) {
  const headers = new Headers();
  for (const name of ['authorization', 'content-type', 'cookie', 'x-age-gate-token', 'x-session-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const gateSession = request.cookies.get('age_gate_session')?.value;
  if (gateSession && !headers.has('x-session-id')) headers.set('x-session-id', gateSession);
  return headers;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
