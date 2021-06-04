import * as child from "child_process";

export interface ExecOutput {
  stdout: string,
  stderr: string,
}

/**
 * Helper which runs a given shell command with arguments, and returns the stdout 
 * and stderr it outputs.
 * 
 * @param command the command to run
 * @param args command line arguments
 * @returns stdout and stderr
 */
export function Exec(command: string, args: string[]): Promise<ExecOutput> {
  return new Promise((res, rej) => {
    const proc = child.spawn(command, args);
    let stdoutOutput = "";
    let stderrOutput = "";
    proc.stdout.on("data", (d) => { stdoutOutput += d.toString() });
    proc.stderr.on("data", (d) => { stderrOutput += d.toString() });
    proc.on("close", () => res({
      stdout: stdoutOutput,
      stderr: stderrOutput,
    }));
  });
}
