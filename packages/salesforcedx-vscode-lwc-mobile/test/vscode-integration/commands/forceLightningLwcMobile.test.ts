/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  CommandBuilder,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CancellationToken } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
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
const { notificationService } = sfdxCoreExports;

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
  let executeSpy: sinon.SinonSpy<
    [(CancellationToken | undefined)?],
    CliCommandExecution
  >;

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

    constructor(shouldRemember: boolean) {
      this.shouldRemember = shouldRemember;
    }

    readonly [key: string]: any;
    public get<T>(section: string): T | undefined;
    public get<T>(section: string, defaultValue: T): T;
    public get(section: any, defaultValue?: any) {
      return this.shouldRemember;
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
    executeSpy = sandbox.spy(CliCommandExecutor.prototype, 'execute');
  });

  afterEach(() => {
    sandbox.restore();
    cmdWithArgSpy.restore();
    cmdWithFlagSpy.restore();
    executeSpy.restore();
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

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(
      'force:lightning:local:preview'
    );
    expect(cmdWithFlagSpy.callCount).to.equal(3);
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
      'http://localhost:3333/lwc/preview/c/foo'
    ]);
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(1);
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

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(1);
    expect(cmdWithArgSpy.getCall(0).args[0]).equals(
      'force:lightning:local:preview'
    );
    expect(cmdWithFlagSpy.callCount).to.equal(3);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      'SFDXSimulator'
    ]);
    expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
      '-d',
      'http://localhost:3333/lwc/preview/c/foo'
    ]);
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(1);
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
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(1);
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

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      deviceName
    ]);
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(1);
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
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(1);
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

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members(['-p', 'iOS']);
    expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
      '-t',
      rememberediOSDevice
    ]);
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(1);
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
    const showWarningSpy = sandbox.spy(vscode.window, 'showWarningMessage');
    await forceLightningLwcMobile(validSourceUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(0);
    expect(cmdWithFlagSpy.callCount).to.equal(0);
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(0);

    expect(showWarningSpy.callCount).to.equal(0);
    expect(
      showWarningSpy.calledWith(
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
    const showWarningSpy = sandbox.spy(vscode.window, 'showWarningMessage');
    await forceLightningLwcMobile(validSourceUri);

    sinon.assert.calledOnce(showQuickPickStub);
    sinon.assert.calledOnce(showInputBoxStub);
    expect(cmdWithArgSpy.callCount).to.equal(0);
    expect(cmdWithFlagSpy.callCount).to.equal(0);
    expect(
      executeSpy.callCount,
      'Expected execute to be called once.'
    ).to.equal(0);

    expect(showWarningSpy.callCount).to.equal(0);
    expect(
      showWarningSpy.calledWith(
        nls.localize('force_lightning_lwc_mobile_device_cancelled')
      )
    );
  });

  // TODO:  Stub SFDX execution to test setup error scenarios.
});
