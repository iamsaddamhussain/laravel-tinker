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
        'Laravel Tinker (Textarea)',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      const htmlPath = path.join(context.extensionPath, 'media', 'tinker.html'); // or wherever you put the file
      const html = fs.readFileSync(htmlPath, 'utf8');
      panel.webview.html = html;

      panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'runTinker') {
          const root = vscode.workspace.rootPath || '';
          const autoloadPath = path.join(root, 'vendor', 'autoload.php').replace(/\\/g, '/');
          const bootstrapPath = path.join(root, 'bootstrap', 'app.php').replace(/\\/g, '/');

          const modelUses = getModelImports(root);
          const userCode = prepareUserCode(message.text);

          const wrapped = `<?php
            require '${autoloadPath}';
            ${modelUses}

            \$app = require '${bootstrapPath}';
            \$kernel = \$app->make(Illuminate\\Contracts\\Console\\Kernel::class);
            \$kernel->bootstrap();

            ${userCode}
            `;

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

function getModelImports(projectRoot: string): string {
  const modelDir = path.join(projectRoot, 'app', 'Models');
  if (!fs.existsSync(modelDir)) {return '';}

  const modelFiles = glob.sync('**/*.php', { cwd: modelDir });

  const uses = modelFiles.map(file => {
    const className = file.replace(/\.php$/, '').replace(/\//g, '\\');
    return `use App\\Models\\${className};`;
  });

  return uses.join('\n');
}

function prepareUserCode(input: string): string {
  const trimmedInput = input.trim();

  // Extract last meaningful line
  const lines = trimmedInput.split('\n').filter(line => line.trim() !== '');
  const lastLine = lines[lines.length - 1].trim();

  const isControlStructure = /^(if|foreach|while|switch|return|echo|dd|\$[a-zA-Z_])/i.test(lastLine);
  const isAssignment = /=/.test(lastLine) && !/=>/.test(lastLine);
  const endsWithSemicolon = lastLine.endsWith(';');
  const isComment = lastLine.startsWith('//');

  const shouldWrap =
    !isControlStructure &&
    !isAssignment &&
    !isComment;

  // Wrap entire code block in echo json_encode() if it's an expression
  if (shouldWrap) {
    const expression = trimmedInput.replace(/;$/, ''); // remove trailing semicolon if any
    return `echo json_encode(${expression}, JSON_PRETTY_PRINT);`;
  }

  // Otherwise return as-is (add semicolon if missing)
  if (!endsWithSemicolon && !lastLine.endsWith('}')) {
    lines[lines.length - 1] += ';';
  }

  return lines.join('\n');
}


