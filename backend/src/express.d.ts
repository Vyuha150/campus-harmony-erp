import 'express-serve-static-core';

// Narrow express Request query/params to basic string values to simplify common usage
// in this project and avoid repeated casts for `req.params` and `req.query`.
// This is a convenience for our internal API implementation and assumes that
// route params and query strings are simple strings (or undefined).

declare module 'express-serve-static-core' {
  interface Request {
    params: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    user?: {
      id: string;
      role: string;
    };
  }
}
