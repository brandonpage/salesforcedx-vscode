/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { componentUtil } from '@salesforce/lightning-lsp-common';
import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getGlobalStore, getWorkspaceSettings } from '../index';
import { nls } from '../messages';
import { DevServerService } from '../service/devServerService';
import { DEV_SERVER_PREVIEW_ROUTE } from './commandConstants';
import { openBrowser, showError } from './commandUtils';
import { ForceLightningLwcStartExecutor } from './forceLightningLwcStart';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;

const {
  SfdxCommandlet,
  telemetryService,
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} = sfdxCoreExports;

const logName = 'force_lightning_lwc_preview';
const commandName = nls.localize('force_lightning_lwc_preview_text');
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export enum PreviewPlatformType {
  Desktop = 1,
  iOS,
  Android
}

interface PreviewQuickPickItem extends vscode.QuickPickItem {
  id: PreviewPlatformType;
  defaultTargetName: string;
  platformName: string;
}

const platformInput: PreviewQuickPickItem[] = [
  {
    label: nls.localize('force_lightning_lwc_preview_desktop_label'),
    detail: nls.localize('force_lightning_lwc_preview_desktop_description'),
    alwaysShow: true,
    picked: true,
    id: PreviewPlatformType.Desktop,
    platformName: '',
    defaultTargetName: ''
  },
  {
    label: nls.localize('force_lightning_lwc_preview_ios_label'),
    detail: nls.localize('force_lightning_lwc_preview_ios_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.iOS,
    platformName: 'iOS',
    defaultTargetName: 'SFDXSimulator'
  },
  {
    label: nls.localize('force_lightning_lwc_preview_android_label'),
    detail: nls.localize('force_lightning_lwc_preview_android_description'),
    alwaysShow: true,
    picked: false,
    id: PreviewPlatformType.Android,
    platformName: 'Android',
    defaultTargetName: 'SFDXEmulator'
  }
];

export async function forceLightningLwcPreview(sourceUri: vscode.Uri) {
  const startTime = process.hrtime();
  if (!sourceUri) {
    if (vscode.window.activeTextEditor) {
      sourceUri = vscode.window.activeTextEditor.document.uri;
    } else {
      const message = nls.localize(
        'force_lightning_lwc_preview_file_undefined',
        sourceUri
      );
      showError(new Error(message), logName, commandName);
      return;
    }
  }

  const resourcePath = sourceUri.path;
  if (!resourcePath) {
    const message = nls.localize('force_lightning_lwc_preview_file_undefined');
    showError(new Error(message), logName, commandName);
    return;
  }

  if (!fs.existsSync(resourcePath)) {
    const message = nls.localize(
      'force_lightning_lwc_preview_file_nonexist',
      resourcePath
    );
    showError(new Error(message), logName, commandName);
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
    showError(new Error(message), logName, commandName);
    return;
  }

  const platformSelection = await vscode.window.showQuickPick(platformInput, {
    placeHolder: nls.localize('force_lightning_lwc_preview_platform_selection')
  });
  if (!platformSelection) {
    console.log(`${logName}: No valid selection made for preview...`);
    return;
  }

  const fullUrl = `${DEV_SERVER_PREVIEW_ROUTE}/${componentName}`;
  const desktopSelected = platformSelection.id === PreviewPlatformType.Desktop;
  let target: string = platformSelection.defaultTargetName;
  if (!desktopSelected) {
    let placeholderText = nls.localize(
      'force_lightning_lwc_preview_target_default'
    );
    const deviceConfig = getWorkspaceSettings().get('rememberDevice') || false;
    const lastTarget = getRememberedDevice(platformSelection);

    // Remember device setting enabled and previous device retrieved.
    if (deviceConfig && lastTarget) {
      placeholderText = nls.localize(
        'force_lightning_lwc_preview_target_remembered',
        lastTarget
      );
      target = lastTarget;
    }
    const targetName = await vscode.window.showInputBox({
      placeHolder: placeholderText
    });

    if (targetName === undefined) {
      vscode.window.showInformationMessage(
        nls.localize('force_lightning_lwc_preview_device_cancelled')
      );
      return;
    }

    // New target device entered
    if (targetName !== '') {
      updateRememberedDevice(platformSelection, targetName);
      target = targetName;
    }

    // Start Server if not running.
    if (!DevServerService.instance.isServerHandlerRegistered()) {
      console.log(`${logName}: server was not running, starting...`);
      const preconditionChecker = new SfdxWorkspaceChecker();
      const parameterGatherer = new EmptyParametersGatherer();
      const executor = new ForceLightningLwcStartExecutor({
        openBrowser: desktopSelected,
        fullUrl
      });

      const commandlet = new SfdxCommandlet(
        preconditionChecker,
        parameterGatherer,
        executor
      );

      await commandlet.run();
      telemetryService.sendCommandEvent(logName, startTime);
    } else if (desktopSelected) {
      try {
        await openBrowser(fullUrl);
        telemetryService.sendCommandEvent(logName, startTime);
      } catch (e) {
        showError(e, logName, commandName);
      }
      return;
    }

    // Launch Mobile Device
    const mobileCancellationTokenSource = new vscode.CancellationTokenSource();
    const mobileCancellationToken = mobileCancellationTokenSource.token;

    const command = new SfdxCommandBuilder()
      .withDescription(commandName)
      .withArg('force:lightning:lwc:preview')
      .withFlag('-p', platformSelection.platformName)
      .withFlag('-t', target || platformSelection.defaultTargetName)
      .withFlag('-f', fullUrl)
      .build();

    const mobileExecutor = new CliCommandExecutor(command, {
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    });
    mobileExecutor.execute(mobileCancellationToken);
  }
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
