import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = process.env.SESSION_SECRET || 'default-dev-secret-change-in-production';
const encodedKey = new TextEncoder().encode(secretKey);

const PUBLIC_PATHS = ['/login'];
const ADMIN_PATHS = ['/settings', '/users', '/leaves'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });

    if (ADMIN_PATHS.some(p => pathname.startsWith(p))) {
      if (payload.role !== 'admin' && payload.role !== 'super_admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    if (pathname.startsWith('/employee/')) {
      const code = pathname.split('/employee/')[1]?.split('/')[0];
      if (payload.role === 'employee' && payload.employeeCode && payload.employeeCode !== code) {
        return NextResponse.redirect(new URL(`/employee/${payload.employeeCode}`, request.url));
      }
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
