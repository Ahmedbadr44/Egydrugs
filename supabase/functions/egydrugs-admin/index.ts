import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async () => {
  return new Response(
    JSON.stringify({
      error: "This admin endpoint has been retired.",
      message: "Manage EgyMeds data from Supabase Dashboard > Table Editor."
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
});
