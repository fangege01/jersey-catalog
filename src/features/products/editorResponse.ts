export function productEditorResponse(request: Request, location: string, error?: string) {
  if (request.headers.get('accept')?.includes('application/json')) {
    return Response.json(error ? { error } : { location }, { status: error ? 422 : 200 });
  }
  return new Response(null, { status: 303, headers: { location } });
}
