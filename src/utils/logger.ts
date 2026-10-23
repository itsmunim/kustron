import chalk from 'chalk';

const prefix = {
  info: chalk.blue('ℹ'),
  success: chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  step: chalk.cyan('→'),
};

/**
 * Machine mode: when true, human progress printing (info/success/step) is
 * suppressed so `--json` commands keep stdout pure machine output.
 * Warnings and errors always reach stderr and are not gated.
 */
let machineQuiet = false;

export function setMachineQuiet(quiet: boolean): void {
  machineQuiet = quiet;
}

export function info(message: string): void {
  if (machineQuiet) return;
  console.log(`${prefix.info} ${message}`);
}

export function success(message: string): void {
  if (machineQuiet) return;
  console.log(`${prefix.success} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${prefix.warn} ${message}`);
}

export function error(message: string): void {
  console.error(`${prefix.error} ${message}`);
}

export function step(message: string): void {
  if (machineQuiet) return;
  console.log(`${prefix.step} ${message}`);
}
