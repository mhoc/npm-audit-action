"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Exec = void 0;
const child = require("child_process");
/**
 * Helper which runs a given shell command with arguments, and returns the stdout
 * and stderr it outputs.
 *
 * @param command the command to run
 * @param args command line arguments
 * @returns stdout and stderr
 */
function Exec(command, args) {
    return new Promise((res, rej) => {
        const proc = child.spawn(command, args);
        let stdoutOutput = "";
        let stderrOutput = "";
        proc.stdout.on("data", (d) => { stdoutOutput += d.toString(); });
        proc.stderr.on("data", (d) => { stderrOutput += d.toString(); });
        proc.on("close", () => res({
            stdout: stdoutOutput,
            stderr: stderrOutput,
        }));
    });
}
exports.Exec = Exec;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXhlYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9FeGVjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHVDQUF1QztBQU92Qzs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsSUFBSSxDQUFDLE9BQWUsRUFBRSxJQUFjO0lBQ2xELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7UUFDOUIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEMsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLFlBQVksSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLFlBQVksSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUM7WUFDekIsTUFBTSxFQUFFLFlBQVk7WUFDcEIsTUFBTSxFQUFFLFlBQVk7U0FDckIsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFaRCxvQkFZQyJ9