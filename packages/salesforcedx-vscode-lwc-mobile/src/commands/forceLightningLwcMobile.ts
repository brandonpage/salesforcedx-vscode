/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { componentUtil } from '@salesforce/lightning-lsp-common';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getGlobalStore, getWorkspaceSettings } from '..';
import { nls } from '../messages';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  notificationService,
  telemetryService
} = sfdxCoreExports;

export enum PreviewPlatformType {
  Android = 1,
  iOS
}

export interface PreviewQuickPickItem extends vscode.QuickPickItem {
  label: string;
  detail: string;
  alwaysShow: boolean;
  picked: boolean;
  id: PreviewPlatformType;
  defaultTargetName: string;
  platformName: string;
}

export const platformInput: PreviewQuickPickItem[] = [
  {
    label: nls.localize('force_lightning_lwc_mobile_android_label'),
    detail: nls.localize('force_lightning_lwc_mobile_android_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.Android,
    platformName: 'Android',
    defaultTargetName: 'SFDXEmulator'
  },
  {
    label: nls.localize('force_lightning_lwc_mobile_ios_label'),
    detail: nls.localize('force_lightning_lwc_mobile_ios_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.iOS,
    platformName: 'iOS',
    defaultTargetName: 'SFDXSimulator'
  }
];

const logName = 'force_lightning_lwc_mobile';
const commandName = nls.localize('force_lightning_lwc_mobile_text');

export async function forceLightningLwcMobile(sourceUri: vscode.Uri) {
  const startTime = process.hrtime();

  if (!sourceUri) {
    if (vscode.window.activeTextEditor) {
      sourceUri = vscode.window.activeTextEditor.document.uri;
    } else {
      const message = nls.localize(
        'force_lightning_lwc_preview_file_undefined',
        sourceUri
      );
      showError(new Error(message));
      return;
    }
  }

  const resourcePath = sourceUri.path;
  if (!resourcePath) {
    const message = nls.localize(
      'force_lightning_lwc_preview_file_undefined',
      resourcePath
    );
    showError(new Error(message));
    return;
  }

  if (!fs.existsSync(resourcePath)) {
    const message = nls.localize(
      'force_lightning_lwc_file_nonexist',
      resourcePath
    );
    showError(new Error(message));
    return;
  }

  const isSFDX = true; // TODO support non SFDX projects
  const isDirectory = fs.lstatSync(resourcePath).isDirectory();
  const componentName = isDirectory
    ? componentUtil.moduleFromDirectory(resourcePath, isSFDX)
    : componentUtil.moduleFromFile(resourcePath, isSFDX);
  if (!componentName) {
    const message = nls.localize(
      'force_lightning_lwc_preview_unsupported',
      resourcePath
    );
    showError(new Error(message));
    return;
  }

  const platformSelection = await vscode.window.showQuickPick(platformInput, {
    placeHolder: nls.localize('force_lightning_lwc_mobile_platform_selection')
  });
  if (!platformSelection) {
    vscode.window.showWarningMessage(
      nls.localize('force_lightning_lwc_mobile_cancelled')
    );
    return;
  }

  let target: string = platformSelection.defaultTargetName;
  let placeholderText = nls.localize(
    'force_lightning_lwc_mobile_target_default'
  );
  const rememberDeviceConfigured =
    getWorkspaceSettings().get('rememberDevice') || false;
  const lastTarget = getRememberedDevice(platformSelection);

  // Remember device setting enabled and previous device retrieved.
  if (rememberDeviceConfigured && lastTarget) {
    placeholderText = nls.localize(
      'force_lightning_lwc_mobile_target_remembered',
      lastTarget
    );
    target = lastTarget;
  }
  const targetName = await vscode.window.showInputBox({
    placeHolder: placeholderText
  });

  if (targetName === undefined) {
    vscode.window.showInformationMessage(
      nls.localize('force_lightning_lwc_mobile_device_cancelled')
    );
    return;
  }

  // New target device entered
  if (targetName !== '') {
    updateRememberedDevice(platformSelection, targetName);
    target = targetName;
  }

  const mobileCancellationTokenSource = new vscode.CancellationTokenSource();
  const mobileCancellationToken = mobileCancellationTokenSource.token;

  // TODO: Remove `fullUrl` and use `componentName` when SFDX plugin is ready.
  const fullUrl = `http://localhost:3333/lwc/preview/${componentName}`;
  // TODO: Add setting for loglevel
  const command = new SfdxCommandBuilder()
    .withDescription(commandName)
    .withArg('force:lightning:local:preview')
    .withFlag('-p', platformSelection.platformName)
    .withFlag('-t', target || platformSelection.defaultTargetName)
    .withFlag('-d', fullUrl)
    .build();

  const mobileExecutor = new CliCommandExecutor(command, {
    env: { SFDX_JSON_TO_STDOUT: 'true' }
  });
  const execution = mobileExecutor.execute(mobileCancellationToken);
  telemetryService.sendCommandEvent(logName, startTime);

  execution.processExitSubject.subscribe(async exitCode => {
    if (exitCode !== 0) {
      channelService.streamCommandOutput(execution);
      const message =
        platformSelection.id === PreviewPlatformType.Android
          ? nls.localize('force_lightning_lwc_mobile_android_failure')
          : nls.localize('force_lightning_lwc_mobile_ios_failure');
      showError(new Error(message));
    } else {
      notificationService.showSuccessfulExecution(execution.command.toString());
      const message =
        platformSelection.id === PreviewPlatformType.Android
          ? nls.localize('force_lightning_lwc_mobile_android_start')
          : nls.localize('force_lightning_lwc_mobile_ios_start');
      vscode.window.showInformationMessage(message);
    }
  });
}

function getRememberedDevice(platform: PreviewQuickPickItem): string {
  return getGlobalStore().get(`last${platform.platformName}Device`, '');
}

function updateRememberedDevice(
  platform: PreviewQuickPickItem,
  deviceName: string
) {
  getGlobalStore().update(`last${platform.platformName}Device`, deviceName);
}

function showError(e: Error) {
  telemetryService.sendException(`${logName}_error`, e.message);
  notificationService.showErrorMessage(e.message);
}
