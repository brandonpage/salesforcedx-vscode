/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandBuilder,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CliCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CancellationToken } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
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
  let cmdWithArgSpy: sinon.SinonSpy<[string], CommandBuilder>;
  let cmdWithFlagSpy: sinon.SinonSpy<[string, string], CommandBuilder>;
  let mobileExecutorStub: sinon.SinonStub<
    [(CancellationToken | undefined)?],
    CliCommandExecution | MockExecution
  >;
  let mockExecution: MockExecution;
  let showWarningMessageSpy: sinon.SinonSpy<any, any>;
  let successInfoMessageSpy: sinon.SinonSpy<any, any>;
  let streamCommandOutputSpy: sinon.SinonSpy<any, any>;
  let appendLineSpy: sinon.SinonSpy<any, any>;

  const validSourcePath = path.join(
    'dev',
    'project',
    'force-app',
    'main',
    'default',
    'lwc',
    'foo',
    'foo.js'
  );
  const validSourceUri = { path: validSourcePath } as vscode.Uri;
  const androidQuickPick = platformInput[0];
  const iOSQuickPick = platformInput[1];
  const rememberedAndroidDevice = 'rememberedAndroid';
  const rememberediOSDevice = 'rememberediOS';

  class MockMemento implements vscode.Memento {
    public get<T>(key: string): T | undefined {
      switch (key) {
        case 'lastAndroidDevice':
          return (rememberedAndroidDevice as unknown) as T;
        case 'lastiOSDevice':
          return (rememberediOSDevice as unknown) as T;
        default:
          return undefined;
      }
    }
    public update(key: string, value: any): Thenable<void> {
      return Promise.resolve();
    }
  }

  class MockWorkspace implements vscode.WorkspaceConfiguration {
    // tslint:disable-next-line:member-access
    shouldRemember = false;
    // tslint:disable-next-line:member-access
    loglevel = 'warn';

    constructor(shouldRemember: boolean, loglevel?: string) {
      this.shouldRemember = shouldRemember;
      if (loglevel !== undefined) {
        this.loglevel = loglevel;
      }
    }

    readonly [key: string]: any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any) {
      if (section === 'loglevel') {
        return this.loglevel;
      } else {
        return this.shouldRemember;
      }
    }
    public has(section: string): boolean {
      return this.shouldRemember;
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

  class MockExecution implements CommandExecution {
    public command: Command;
    public processExitSubject: Subject<number>;
    public processErrorSubject: Subject<Error>;
    public stdoutSubject: Subject<string>;
    public stderrSubject: Subject<string>;
    private readonly childProcessPid: any;

    constructor(command: Command) {
      this.command = command;
      this.processExitSubject = new Subject<number>();
      this.processErrorSubject = new Subject<Error>();
      this.stdoutSubject = new Subject<string>();
      this.stderrSubject = new Subject<string>();
      this.childProcessPid = '';
    }

    public killExecution(signal?: string): Promise<void> {
      return Promise.resolve();
    }
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    existsSyncStub = sandbox.stub(fs, 'existsSync');
    lstatSyncStub = sandbox.stub(fs, 'lstatSync');
    showErrorMessageStub = sandbox.stub(
      notificationService,
      'showErrorMessage'
    );
    showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    getConfigurationStub = sandbox.stub(utils, 'getWorkspaceSettings');
    getGlobalStoreStub = sandbox.stub(utils, 'getGlobalStore');
    cmdWithArgSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withArg');
    cmdWithFlagSpy = sandbox.spy(SfdxCommandBuilder.prototype, 'withFlag');
    mockExecution = new MockExecution(new SfdxCommandBuilder().build());
    mobileExecutorStub = sinon.stub(CliCommandExecutor.prototype, 'execute');
    mobileExecutorStub.returns(mockExecution);
    showWarningMessageSpy = sandbox.spy(vscode.window, 'showWarningMessage');
    successInfoMessageSpy = sandbox.spy(
      vscode.window,
      'showInformationMessage'
    );
    streamCommandOutputSpy = sandbox.stub(
      channelService,
      'streamCommandOutput'
    );
    appendLineSpy = sinon.spy(channelService, 'appendLine');
  });

  afterEach(() => {
    sandbox.restore();
    cmdWithArgSpy.restore();
    cmdWithFlagSpy.restore();
    showWarningMessageSpy.restore();
    successInfoMessageSpy.restore();
    mobileExecutorStub.restore();
    streamCommandOutputSpy.restore();
    appendLineSpy.restore();
  });

  it('calls SFDX preview with the correct url for files', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(
      'force:lightning:local:preview'
    );
    expect(cmdWithFlagSpy.callCount).to.equal(4);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXEmulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-d',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
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

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(sourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(
      'force:lightning:local:preview'
    );
    expect(cmdWithFlagSpy.callCount).to.equal(4);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXSimulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-d',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '--loglevel',
      'warn'
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
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

    getConfigurationStub.returns(new MockWorkspace(false));
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
    sinon.assert.notCalled(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows an error when source path does not exist', async () => {
    const testPath = path.join('foo');
    const sourceUri = { path: testPath } as vscode.Uri;

    existsSyncStub.returns(false);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcMobile(sourceUri);

    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize(`force_lightning_lwc_file_nonexist`, 'foo'))
    );
    sinon.assert.notCalled(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('calls SFDX preview with specified Android device name', async () => {
    const deviceName = 'androidtestname';
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

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves(deviceName);
    await forceLightningLwcMobile(sourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('calls SFDX preview with specified iOS device name', async () => {
    const deviceName = 'iostestname';
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves(deviceName);
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('calls SFDX preview with remembered Android device name', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      rememberedAndroidDevice
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('calls SFDX preview with remembered iOS device name', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      rememberediOSDevice
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });

  it('shows warning when you cancel Android device name input', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    // This simulates the user hitting the escape key to cancel input.
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcMobile(validSourceUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(0);
    expect(cmdWithFlagSpy.callCount).to.equal(0);
    sinon.assert.notCalled(mobileExecutorStub);
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_mobile_device_cancelled')
      )
    );
  });

  it('shows warning when you cancel iOS device name input', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return true;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(true));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    // This simulates the user hitting the escape key to cancel input.
    showInputBoxStub.resolves(undefined);
    await forceLightningLwcMobile(validSourceUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(0);
    expect(cmdWithFlagSpy.callCount).to.equal(0);
    sinon.assert.notCalled(mobileExecutorStub);
    expect(
      showWarningMessageSpy.calledWith(
        nls.localize('force_lightning_lwc_mobile_device_cancelled')
      )
    );
  });

  it('shows error in console when Android SFDX execution fails', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(1);

    sinon.assert.calledOnce(mobileExecutorStub);
    sinon.assert.calledOnce(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('force_lightning_lwc_mobile_android_failure'))
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows error in console when iOS SFDX execution fails', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(iOSQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(1);

    sinon.assert.calledOnce(mobileExecutorStub);
    sinon.assert.calledOnce(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('force_lightning_lwc_mobile_ios_failure'))
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);
  });

  it('shows install message if sfdx plugin is not installed', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');

    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(127);

    sinon.assert.calledOnce(mobileExecutorStub);
    sinon.assert.calledOnce(showErrorMessageStub);
    sinon.assert.calledWith(
      showErrorMessageStub,
      sinon.match(nls.localize('force_lightning_lwc_mobile_android_failure'))
    );
    sinon.assert.calledOnce(streamCommandOutputSpy);
    expect(successInfoMessageSpy.callCount).to.equal(0);

    sinon.assert.calledOnce(appendLineSpy);
    expect(
      appendLineSpy.calledWith(
        nls.localize('force_lightning_lwc_mobile_no_plugin')
      )
    );
  });

  it('correct log level is used when the setting is changed', async () => {
    existsSyncStub.returns(true);
    lstatSyncStub.returns({
      isDirectory() {
        return false;
      }
    } as fs.Stats);

    getConfigurationStub.returns(new MockWorkspace(false, 'debug'));
    getGlobalStoreStub.returns(new MockMemento());
    showQuickPickStub.resolves(androidQuickPick);
    showInputBoxStub.resolves('');
    await forceLightningLwcMobile(validSourceUri);
    mockExecution.processExitSubject.next(0);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(
      'force:lightning:local:preview'
    );
    expect(cmdWithFlagSpy.callCount).to.equal(4);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
      '-p',
      'Android'
    ]);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXEmulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-d',
      'c/foo'
    ]);
    expect(cmdWithFlagSpy.getCall(3).args).to.have.same.members([
      '--loglevel',
      'debug'
    ]);
    sinon.assert.calledOnce(mobileExecutorStub);
    expect(successInfoMessageSpy.callCount).to.equal(1);
  });
});
