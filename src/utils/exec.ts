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

export async function exec(
  command: string,
  args: string[],
  options?: {input?: string; silent?: boolean} & Omit<ExecaOptions, 'input'>,
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

  try {
    const subprocess = execa(command, args, opts as ExecaOptions);

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
    const stdout = verboseMode ? captureStdout.join('') : String(ex.stdout ?? '');
    const stderr = verboseMode ? captureStderr.join('') : String(ex.stderr ?? '');
    const message = String(stderr ?? stdout ?? ex.message ?? t('errors.unknownError'));
    error(
      t('errors.commandFailed', {
        command: `${command} ${args.join(' ')}`,
        message,
      }),
    );
    throw new KustronExecError(
      message,
      `${command} ${args.join(' ')}`,
      ex.exitCode,
    );
  }
}
