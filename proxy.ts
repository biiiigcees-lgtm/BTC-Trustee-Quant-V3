import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isApiRoute = createRouteMatcher(['/api/(.*)']);

export default clerkMiddleware((auth, request) => {
  // All API routes are completely public; no auth check.
  if (isApiRoute(request)) {
    return NextResponse.next();
  }

  // Only protect non-API routes if needed in future.
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
