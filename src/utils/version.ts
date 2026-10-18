import pkg from '../../package.json' with {type: 'json'};

// Bundled into the CLI at build time; `npm run release` runs the build after
// `changeset version` has bumped package.json, so the shipped binary reports
// the version it was actually released as.
export function getPackageVersion(): string {
  return pkg.version;
}
