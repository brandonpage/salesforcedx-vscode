/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import * as vscode from 'vscode';
import {
  ConfigurationTarget,
  ExtensionContext,
  Uri,
  workspace,
  WorkspaceConfiguration
} from 'vscode';
import { forceLightningLwcMobile } from './commands';
import { telemetryService } from './telemetry';

let extensionContext: vscode.ExtensionContext;

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export function code2ProtocolConverter(value: Uri) {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

export async function activate(context: ExtensionContext) {
  extensionContext = context;
  const extensionHRStart = process.hrtime();
  console.log('Activation Mode: ' + getActivationMode());
  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    console.log('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach((folder: { uri: { fsPath: string } }) => {
    workspaceUris.push(folder.uri.fsPath);
  });

  // If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = lspCommon.detectWorkspaceType(workspaceUris);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    console.log(
      'LWC LSP - autodetect did not find a valid project structure, exiting....'
    );
    console.log('WorkspaceType detected: ' + workspaceType);
    return;
  }
  // If activationMode === always, ignore workspace type and continue activating

  // register commands
  const ourCommands = registerCommands();
  context.subscriptions.push(ourCommands);

  // If we get here, we either passed autodetect validation or activationMode == always
  console.log('Lightning Web Components Mobile Extension Activated');
  console.log('WorkspaceType detected: ' + workspaceType);

  // Notify telemetry that our extension is now active
  telemetryService.sendExtensionActivationEvent(extensionHRStart).catch();
}

export async function deactivate() {
  console.log('Mobile Lightning Web Components Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent().catch();
}

function getActivationMode(): string {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') || 'autodetect'; // default to autodetect
}

function registerCommands(): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(
      'sfdx.force.lightning.lwc.mobile',
      forceLightningLwcMobile
    )
  );
}

export function getGlobalStore(): vscode.Memento {
  return extensionContext.globalState;
}

export function getWorkspaceSettings(): vscode.WorkspaceConfiguration {
  return workspace.getConfiguration('salesforcedx-vscode-lwc-mobile');
}
