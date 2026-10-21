import {execa, type Options as ExecaOptions} from 'execa';
import {error} from './logger.js';
import {t} from './i18n.js';

let verboseMode = false;

export function setVerbose(verbose: boolean): void {
  verboseMode = verbose;
}

export function isVerbose(): boolean {
  return verboseMode;
}

export class KustronExecError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = 'KustronExecError';
  }
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Options for {@link exec}.
 *
 * `stream`: pipe the child's stdout/stderr straight to the parent's console,
 *  while still capturing the final text into the {@link ExecResult}. Use for
 *  long-lived, human-directed commands (e.g. `kubectl logs -f`) whose output
 *  matters while running — capture-only commands swallow them for good.
 */
export interface ExecOptions {
  input?: string;
  silent?: boolean;
  stream?: boolean;
}

/**
 * Strip sensitive values from command strings before logging.
 * Matches common password flags across kubectl, helm, docker, podman, git, etc.
 */
export function sanitizeCommand(cmd: string): string {
  return cmd
    .replace(/(--password\s+)\S+/g, '$1***')
    .replace(/(--docker-password\s+)\S+/g, '$1***')
    .replace(/(--token\s+)\S+/g, '$1***')
    .replace(/(--p\s+)\S+/g, '$1***')
    .replace(/(-p\s+)\S+/g, '$1***')
    .replace(/(--registry-password\s+)\S+/g, '$1***');
}

export async function exec(
  command: string,
  args: string[],
  options?: ExecOptions & Omit<ExecaOptions, 'input'>,
): Promise<ExecResult> {
  const opts: Record<string, unknown> = {
    ...(options ?? {}),
  };

  if (options?.input) {
    opts.input = options.input;
  }

  // Always capture stdout/stderr so JSON parsing and other consumers work.
  // In verbose mode we also stream to the console.
  const captureStdout: string[] = [];
  const captureStderr: string[] = [];

  const fullCommand = `${command} ${args.join(' ')}`;

  try {
    const subprocess = execa(command, args, opts as ExecaOptions);

    if (options?.stream && subprocess.stdout) {
      subprocess.stdout.pipe(process.stdout);
    }
    if (options?.stream && subprocess.stderr) {
      subprocess.stderr.pipe(process.stderr);
    }

    if (verboseMode && subprocess.stdout) {
      subprocess.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        captureStdout.push(text);
        process.stdout.write(text);
      });
    }
    if (verboseMode && subprocess.stderr) {
      subprocess.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        captureStderr.push(text);
        process.stderr.write(text);
      });
    }

    const result = await subprocess;

    // If we were streaming in verbose mode, use the captured chunks.
    // Otherwise use the result directly.
    const stdout = verboseMode
      ? captureStdout.join('')
      : String(result.stdout ?? '');
    const stderr = verboseMode
      ? captureStderr.join('')
      : String(result.stderr ?? '');

    return {
      stdout,
      stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (err) {
    const ex = err as {
      stdout?: unknown;
      stderr?: unknown;
      message: string;
      command?: string;
      exitCode?: number;
    };
    const stdout = verboseMode
      ? captureStdout.join('')
      : String(ex.stdout ?? '');
    const stderr = verboseMode
      ? captureStderr.join('')
      : String(ex.stderr ?? '');
    const message = String(
      stderr ?? stdout ?? ex.message ?? t('errors.unknownError'),
    );
    // Sanitize before logging so passwords don't leak
    // Silent callers (best-effort probes) print nothing — they handle the
    // failure themselves.
    if (!options?.silent) {
      error(
        t('errors.commandFailed', {
          command: sanitizeCommand(fullCommand),
          message,
        }),
      );
    }
    throw new KustronExecError(
      message,
      sanitizeCommand(fullCommand),
      ex.exitCode,
    );
  }
}
