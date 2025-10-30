// Minimal Deno global stubs for local TypeScript tooling.
// These are for editor/tsserver only; Supabase Edge Functions run on Deno
// which provides the real implementations at runtime.

declare const Deno: {
  /**
   * Start an HTTP server with the given handler.
   * This mirrors the Deno.serve API used in Supabase Edge Functions.
   */
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};