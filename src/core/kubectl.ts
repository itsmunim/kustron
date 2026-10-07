import {exec} from '../utils/exec.js';
import type {ExecResult} from '../utils/exec.js';

/**
 * Run kubectl scoped to a specific k3d cluster context.
 * Never mutates the user's global kubectl context.
 */
export async function kubectl(
  clusterName: string,
  args: string[],
  options?: Parameters<typeof exec>[2],
): Promise<ExecResult> {
  return exec('kubectl', [...args, '--context', `k3d-${clusterName}`], options);
}

/**
 * Run helm scoped to a specific k3d cluster context.
 * Never mutates the user's global kubectl context.
 */
export async function helm(
  clusterName: string,
  args: string[],
  options?: Parameters<typeof exec>[2],
): Promise<ExecResult> {
  return exec('helm', [...args, '--kube-context', `k3d-${clusterName}`], options);
}
