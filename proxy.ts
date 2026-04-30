import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/']);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) {
    // Allow public access to home page
    return;
  }
  
  // Protect other routes
  auth.protect();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
