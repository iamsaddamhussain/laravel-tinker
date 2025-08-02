# Laravel Tinker for VS Code

A simple VS Code extension that allows you to launch Laravel's Tinker REPL directly from the editor.

## Features

- Opens a new terminal window running `php artisan tinker`
- Works inside any Laravel project
- Convenient access from the Command Palette

## Usage

1. Open a Laravel project in VS Code.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
3. Type and run: `Laravel: Open Tinker`
4. A terminal will open with `php artisan tinker` ready to use.

## Requirements

- PHP and Composer installed
- Laravel installed in the opened workspace
- `artisan` file must be present in your project root

## Installation

To install the extension manually:

1. Clone or download this repo
2. Run `vsce package` to create a `.vsix` file
3. Install using:
   ```bash
   code --install-extension laravel-tinker-0.0.1.vsix
