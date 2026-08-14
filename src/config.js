export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    metaAccessToken: env.META_ACCESS_TOKEN?.trim() || "",
    metaGraphVersion: env.META_GRAPH_VERSION?.trim() || "v24.0",
    enablePublicMetadataFallback:
      env.ENABLE_PUBLIC_METADATA_FALLBACK?.toLowerCase() === "true",
    publicBaseUrl: env.PUBLIC_BASE_URL?.trim() || `http://localhost:${env.PORT || 3000}`,
  };
}
