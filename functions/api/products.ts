type Payload = {
  version: string;
  updatedAt: string;
  panels: any[];
  inverters: any[];
};

const KEY = "products.v1.json";

export const onRequestGet: PagesFunction<{
  PV_PRODUCTS: KVNamespace;
}> = async ({ env }) => {
  const value = await env.PV_PRODUCTS.get(KEY);

  if (!value) {
    const empty: Payload = {
      version: "1.0",
      updatedAt: new Date().toISOString(),
      panels: [],
      inverters: [],
    };
    return Response.json(empty, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(value, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin Area"' },
  });
}

function isAuthorized(req: Request, adminUser?: string, adminPass?: string) {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Basic ")) return false;

  const decoded = atob(auth.replace("Basic ", ""));
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;

  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  return user === adminUser && pass === adminPass;
}

export const onRequestPut: PagesFunction<{
  PV_PRODUCTS: KVNamespace;
  ADMIN_USER?: string;
  ADMIN_PASS?: string;
}> = async ({ request, env }) => {
  if (!isAuthorized(request, env.ADMIN_USER, env.ADMIN_PASS)) return unauthorized();

  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.panels) || !Array.isArray(body.inverters)) {
    return Response.json(
      { error: "Invalid payload. Expected { panels: [...], inverters: [...] }" },
      { status: 400 }
    );
  }

  const payload: Payload = {
    version: body.version ?? "1.0",
    updatedAt: new Date().toISOString(),
    panels: body.panels,
    inverters: body.inverters,
  };

  await env.PV_PRODUCTS.put(KEY, JSON.stringify(payload));

  return Response.json({
    ok: true,
    updatedAt: payload.updatedAt,
    panelsCount: payload.panels.length,
    invertersCount: payload.inverters.length,
  });
};
