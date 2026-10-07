import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === '/login';
  const hasSession = Boolean(request.cookies.get('denes_admin_access')?.value || process.env.ADMIN_API_TOKEN);
  if (!hasSession && !isLogin) return NextResponse.redirect(new URL('/login', request.url));
  if (hasSession && isLogin) return NextResponse.redirect(new URL('/', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
