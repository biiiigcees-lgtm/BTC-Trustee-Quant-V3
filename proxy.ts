import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/btc(.*)',
  '/api/consensus(.*)',
  '/api/predict(.*)',
  '/api/god-tier-predict(.*)',
  '/api/ml(.*)',
  '/api/eth(.*)',
  '/api/metrics(.*)',
  '/api/prices(.*)',
  '/api/bets(.*)',
  '/api/allocator(.*)',
  '/api/webhook/clerk',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

const protectedRoutesMiddleware = clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  return protectedRoutesMiddleware(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
