/**
 * Parse a Docker/OCI image reference into its components.
 * Handles: nginx, nginx:latest, localhost:5000/app:v1, app@sha256:abc...
 */
export function parseImageRef(ref: string): {
  registry?: string;
  repository: string;
  tag?: string;
  digest?: string;
} {
  let rest = ref;

  // Extract digest
  const digestIdx = rest.indexOf('@');
  let digest: string | undefined;
  if (digestIdx !== -1) {
    digest = rest.slice(digestIdx + 1);
    rest = rest.slice(0, digestIdx);
  }

  // Extract tag
  const tagIdx = rest.lastIndexOf(':');
  let tag: string | undefined;
  let repository = rest;

  if (tagIdx !== -1) {
    const potentialTag = rest.slice(tagIdx + 1);
    // A valid tag doesn't contain '/' and the part before ':' doesn't end with a protocol scheme.
    // Simple heuristic: if there's no '/' in the potential tag, it's a tag.
    // Also handle registry ports: localhost:5000/image — the ':' before '5000' is part of the registry.
    const beforeColon = rest.slice(0, tagIdx);
    if (!potentialTag.includes('/') && !beforeColon.endsWith('http') && !beforeColon.endsWith('https')) {
      // Additional check: if the potential tag looks like a port (all digits), and there's a '/' after it,
      // then it's not a tag but part of registry:port/path
      const isPort = /^\d+$/.test(potentialTag);
      const hasSlashAfter = rest.indexOf('/', tagIdx) !== -1;
      if (!(isPort && hasSlashAfter)) {
        tag = potentialTag;
        repository = beforeColon;
      }
    }
  }

  return {repository, tag, digest};
}

export function getImageTag(ref: string): string {
  return parseImageRef(ref).tag ?? 'latest';
}

export function getImageRepository(ref: string): string {
  return parseImageRef(ref).repository;
}
