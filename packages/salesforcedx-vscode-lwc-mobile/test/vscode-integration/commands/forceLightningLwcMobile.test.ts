/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { Command } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CancellationToken } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import * as utils from '../../../src/';
import {
  forceLightningLwcMobile,
  platformInput
} from '../../../src/commands/forceLightningLwcMobile';
import { nls } from '../../../src/messages';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { channelService, notificationService } = sfdxCoreExports;

describe('forceLightningLwcMobile', () => {
  let sandbox: SinonSandbox;
  let existsSyncStub: sinon.SinonStub<[fs.PathLike], boolean>;
  let lstatSyncStub: sinon.SinonStub<[fs.PathLike], fs.Stats>;
  let showErrorMessageStub: sinon.SinonStub<any[], any>;
  let showQuickPickStub: sinon.SinonStub<
    [
      vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
      (vscode.QuickPickOptions | undefined)?,
      (vscode.CancellationToken | undefined)?
    ],
    Thenable<vscode.QuickPickItem | undefined>
  >;
  let showInputBoxStub: sinon.SinonStub<
    [
      (vscode.InputBoxOptions | undefined)?,
      (vscode.CancellationToken | undefined)?
    ],
    Thenable<string | undefined>
  >;

  let getConfigurationStub: sinon.SinonStub<any, vscode.WorkspaceConfiguration>;
  let getGlobalStoreStub: sinon.SinonStub<any, vscode.Memento>;

  const androidQuickPick = platformInput[0];
  const iOSQuickPick = platformInput[1];

  class MockMemento implements vscode.Memento {
    public get<T>(key: string): T | undefined {
      // return ('test' as unknown) as T;
      return undefined;
    }
    public update(key: string, value: any): Thenable<void> {
      return Promise.resolve();
    }
  }

  class MockWorkspace implements vscode.WorkspaceConfiguration {
    readonly [key: string]: any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any) {
      return defaultValue;
    }
    public has(section: string): boolean {
      return false;
    }
    public inspect<T>(
      section: string
    ):
      | {
          key: string;
          defaultValue?: T | undefined;
          globalValue?: T | undefined;
          workspaceValue?: T | undefined;
          workspaceFolderValue?: T | undefined;
        }
      | undefined {
      return undefined;
    }
    public update(
      section: string,
      value: any,
      configurationTarget?: boolean | vscode.ConfigurationTarget | undefined
    ): Thenable<void> {
      return Promise.resolve();
    }
  }

  // TODO: Mock SFDX Command Execution
  // class MockCommand implements Command {
  //   public command: string = '';
  //   public description?: string | undefined;
  //   public args: string[] = [];
  //   public logName?: string | undefined;
  //   public toString(): string {
  //     return '';
  //   }
  //   public toCommand(): string {
  //     return '';
  //   }

  //   constructor() {}
  // }

  // class MockExecution extends CliCommandExecution {
  //   public command: import('@salesforce/salesforcedx-utils-vscode/out/src/cli').Command = new MockCommand();
  //   public cancellationToken?:
  //     | import('@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor').CancellationToken
  //     | undefined;
  //   public processExitSubject: any;
  //   public processErrorSubject: any;
  //   public stdoutSubject: any;
  //   public stderrSubject: any;
  //   public killExecution(signal?: string | undefined): Promise<void> {
  //     return Promise.resolve();
  //   }
  // }

  // class FakeExecution implements CommandExecution {
  //   public command: Command;
  //   public processExitSubject: any;
  //   public processErrorSubject: any;
  //   public stdoutSubject: any;
  //   public stderrSubject: any;
  //   private readonly childProcessPid: any;

  //   constructor() {
  //     // this.command = command;
  //     this.command = new MockCommand();
  //     this.processExitSubject = sinon.stub();
  //     this.processErrorSubject = sinon.stub();
  //     this.stdoutSubject = sinon.stub();
  //     this.stderrSubject = sinon.stub();
  //     this.childProcessPid = '';
  //   }

  //   public killExecution(signal?: string): Promise<void> {
  //     return Promise.resolve();
  //   }
  // }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    existsSyncStub = sandbox.stub(fs, 'existsSync');
    lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    // channelServiceStub = sandbox.stub(channelService)
    showErrorMessageStub = sandbox.stub(
      notificationService,
      'showErrorMessage'
    );
    showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');

    getConfigurationStub = sandbox.stub(utils, 'getWorkspaceSettings');
    getGlobalStoreStub = sandbox.stub(utils, 'getGlobalStore');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls SFDX preview with the correct url for files', async () => {
    const testPath = path.join(
      'dev',
      'project',
      'force-app',
      'main',
      'default',
      'lwc',
      'foo',
      'foo.js'
    );
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace());
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('test');

    const spy = sinon.spy(channelService, 'appendLine');
    const cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
    const executeSpy = sinon.spy(CliCommandExecutor.prototype, 'execute');
    // let mobileExecutorStub: SinonStub<
    //   [(CancellationToken | undefined)?],
    //   CliCommandExecution | FakeExecution
    // >;
    // mobileExecutorStub = sandbox.stub(CliCommandExecutor.prototype, 'execute');
    // mobileExecutorStub.returns(new FakeExecution());

    await forceLightningLwcMobile(sourceUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(executeSpy.callCount).to.equal(1);
    // expect(mobileExecutorStub.callCount).to.equal(1);
  });

  it('calls SFDX preview with the correct url for directories', async () => {
    const testPath = path.join(
      'dev',
      'project',
      'force-app',
      'main',
      'default',
      'lwc',
      'foo'
    );
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace());
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(undefined);

    // const mobileExecutorStub = sandbox.stub(
    //   CliCommandExecutor.prototype,
    //   'execute'
    // );
    await forceLightningLwcMobile(sourceUri);

    // sinon.assert.calledOnce(mobileExecutorStub);

    // sinon.assert.calledOnce(openBrowserStub);
    // sinon.assert.calledWith(
    //   openBrowserStub,
    //   sinon.match(`${DEV_SERVER_PREVIEW_ROUTE}/c/foo`)
    // );
  });

  it('shows an error when source path is not recognized as an lwc module file', async () => {
    const testPath = path.join('foo');
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace());
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('test');
    await forceLightningLwcMobile(sourceUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(
        nls.localize(`force_lightning_lwc_preview_unsupported`, 'foo')
      )
    );
  });

  it('shows an error when source path does not exist', async () => {
    const testPath = path.join('foo');
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(false);

    getConfigurationStub.returns(new MockWorkspace());
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcMobile(sourceUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize(`force_lightning_lwc_file_nonexist`, 'foo'))
    );
  });
});
