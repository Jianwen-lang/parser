import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runRenderCli } from '../../src/cli/render';
describe('cli/render', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0, tempRoots.length)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jianwen-cli-'));
    tempRoots.push(root);
    return root;
  }

  it('loads partial theme tokens from --theme-file', () => {
    const root = createTempDir();
    const inputPath = path.join(root, 'input.jw');
    const outputPath = path.join(root, 'output.html');
    const themePath = path.join(root, 'theme.json');

    fs.writeFileSync(inputPath, '# 标题\n\n段落\n', 'utf-8');
    fs.writeFileSync(
      themePath,
      JSON.stringify(
        {
          light: {
            '--jw-strong-color': '#112233',
          },
          dark: {
            '--jw-strong-color': '#ddeeff',
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    runRenderCli([inputPath, '--out', outputPath, '--theme-file', themePath, '--theme', 'dark']);

    const html = fs.readFileSync(outputPath, 'utf-8');
    expect(html).toContain('data-jw-theme="dark"');
    expect(html).toContain('--jw-strong-color: #112233;');
    expect(html).toContain('--jw-strong-color: #ddeeff;');
  });

  it('throws readable errors for invalid theme files', () => {
    const root = createTempDir();
    const inputPath = path.join(root, 'input.jw');
    const outputPath = path.join(root, 'output.html');
    const themePath = path.join(root, 'invalid-theme.json');

    fs.writeFileSync(inputPath, '# 标题\n', 'utf-8');
    fs.writeFileSync(
      themePath,
      JSON.stringify({
        light: {
          '--jw-strong-color': 123,
        },
      }),
      'utf-8',
    );

    expect(() => {
      runRenderCli([inputPath, '--out', outputPath, '--theme-file', themePath]);
    }).toThrow(/token light\.--jw-strong-color must be a string/i);
  });

  it('throws readable errors for unknown theme tokens', () => {
    const root = createTempDir();
    const inputPath = path.join(root, 'input.jw');
    const outputPath = path.join(root, 'output.html');
    const themePath = path.join(root, 'unknown-theme.json');

    fs.writeFileSync(inputPath, '# 标题\n', 'utf-8');
    fs.writeFileSync(
      themePath,
      JSON.stringify({
        dark: {
          '--jw-unknown': '#fff',
        },
      }),
      'utf-8',
    );

    expect(() => {
      runRenderCli([inputPath, '--out', outputPath, '--theme-file', themePath]);
    }).toThrow(/unknown dark token\(s\)/i);
  });
});
