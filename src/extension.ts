import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as glob from 'glob';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('laravel-tinker.webview', () => {
      const panel = vscode.window.createWebviewPanel(
        'laravelTinker',
        'Laravel Tinker',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      const htmlPath = path.join(context.extensionPath, 'media', 'tinker.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      panel.webview.html = html;

      panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'runTinker') {
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

          const autoloadPath = path.join(root, 'vendor', 'autoload.php').replace(/\\/g, '/');
          const bootstrapPath = path.join(root, 'bootstrap', 'app.php').replace(/\\/g, '/');

          if (!fs.existsSync(autoloadPath) || !fs.existsSync(bootstrapPath)) {
            vscode.window.showErrorMessage('Laravel project not detected. Make sure vendor/autoload.php and bootstrap/app.php exist.');
            return;
          }

          const modelUses = getModelImports(root);
          const userCode = prepareUserCode(message.text);
          const wrapped = wrapPhpCode(userCode, autoloadPath, bootstrapPath, modelUses);

          const tmpFile = path.join(os.tmpdir(), 'tinker-vscode.php');
          fs.writeFileSync(tmpFile, wrapped);

          cp.exec(`php "${tmpFile}"`, { cwd: root }, (err, stdout, stderr) => {
            const result = stderr || stdout || '(no output)';
            panel.webview.postMessage({ command: 'result', output: result });
          });
        }
      });
    })
  );
}

function wrapPhpCode(userCode: string, autoloadPath: string, bootstrapPath: string, modelUses: string): string {
  return [
    `<?php`,
    `require '${autoloadPath}';`,
    modelUses,
    ``,
    `$app = require '${bootstrapPath}';`,
    `$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);`,
    `$kernel->bootstrap();`,
    ``,
    userCode,
    ``
  ].join('\n');
}

function getModelImports(projectRoot: string): string {
  const modelDir = path.join(projectRoot, 'app', 'Models');
  if (!fs.existsSync(modelDir)) {return '';}

  const modelFiles = glob.sync('**/*.php', { cwd: modelDir });
  return modelFiles.map(file => {
    const className = file.replace(/\.php$/, '').replace(/\//g, '\\');
    return `use App\\Models\\${className};`;
  }).join('\n');
}

function prepareUserCode(input: string): string {
  const trimmedInput = input.trim();

  const lines = trimmedInput.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {return '';}

  const lastLine = lines[lines.length - 1].trim();

  const isAlreadyOutputting = /^(echo|print|dd|var_dump|print_r)\s*\(/.test(lastLine) || lastLine.startsWith('return ');
  const isControlStructure = /^(if|foreach|while|switch)/.test(lastLine);
  const isAssignment = /=/.test(lastLine) && !/=>/.test(lastLine);
  const isComment = lastLine.startsWith('//');
  const endsWithSemicolon = lastLine.endsWith(';');

  const shouldWrap =
    !isAlreadyOutputting &&
    !isControlStructure &&
    !isAssignment &&
    !isComment &&
    !endsWithSemicolon &&
    !lastLine.endsWith('}');

  if (shouldWrap) {
    lines[lines.length - 1] = `echo json_encode(${lastLine}, JSON_PRETTY_PRINT);`;
  } else if (!endsWithSemicolon && !lastLine.endsWith('}')) {
    lines[lines.length - 1] += ';';
  }

  return lines.join('\n');
}


