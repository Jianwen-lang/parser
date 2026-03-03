import { runRenderCli } from '../src/cli/render';

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: npm run test:render -- <file-path> [cli-options]');
    process.exit(1);
  }

  const extraFlags = ['--format', '--comments', '--runtime'];
  for (const flag of extraFlags) {
    if (!argv.includes(flag)) {
      argv.push(flag);
    }
  }

  runRenderCli(argv);
}

main();
