const { Command, flags } = require("@oclif/command");
const { execSync } = require("child_process");
const fs = require("fs");
const glob = require("glob");
const path = require("path");

class TestCommand extends Command {
  async run() {
    // Check parameters
    const { flags } = this.parse(TestCommand);

    if (!flags.project) {
      this.error("No project directory specified (-p). Exiting.");
      return;
    }

    // Set up paths
    const packageRoot = process.cwd();
    const projectRoot = path.join(packageRoot, flags.project);
    const testsRoot = path.join(projectRoot, "tests");

    const outputRoot = path.join(testsRoot, "generated");

    if (!fs.existsSync(outputRoot)) {
      fs.mkdirSync(outputRoot);
    }

    // Build
    this.log(`Building tests...`);

    const sourceFiles = glob.sync(`${testsRoot}/*.cpp`);
    const testExecutable = path.join(outputRoot, "tests");

    execSync(
      `g++ -I${projectRoot} -I${testsRoot} ${sourceFiles.join(
        " "
      )} -lstdc++ -lm -o ${testExecutable}`,
      {
        cwd: testsRoot,
        stdio: "inherit",
      }
    );

    // Run
    this.log(`Running tests...`);

    execSync(testExecutable, {
      cwd: testsRoot,
      stdio: "inherit",
    });
  }
}

TestCommand.description = `Test firmware project
...
Provide name of project directory with -p
`;

TestCommand.flags = {
  project: flags.string({ char: "p", description: "Project to test" }),
};

module.exports = TestCommand;