/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

'use strict';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as vscode from 'vscode';
import { ExtensionCommands } from '../../ExtensionCommands';
import { FabricRuntimeUtil, FabricNode, FabricEnvironmentRegistryEntry, FabricEnvironmentRegistry, EnvironmentType } from 'ibm-blockchain-platform-common';
import { IBlockchainQuickPickItem, UserInputUtil } from '../../extension/commands/UserInputUtil';
import { TimerUtil } from '../../extension/util/TimerUtil';
import { LocalMicroEnvironmentManager } from '../../extension/fabric/environments/LocalMicroEnvironmentManager';
import { LocalMicroEnvironment } from '../../extension/fabric/environments/LocalMicroEnvironment';

// tslint:disable:no-unused-expression

chai.use(sinonChai);
chai.use(chaiAsPromised);

let opsToolsAllNodesQuickPick: IBlockchainQuickPickItem<FabricNode>[] = [];

module.exports = function(): any {
    /**
     * Given
     */

    this.Given(/the ?('[a-zA-Z]*?')? ?(?:capability)? ?(.*?) environment is running/, this.timeout, async (capability: string, environmentName: string) => {

        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        let runtime: LocalMicroEnvironment = runtimeManager.getRuntime(environmentName);
        let isRunning: boolean;
        if (!runtime) {
            isRunning = false;
        } else {
            isRunning = await runtime.isRunning();
        }

        if (!isRunning) {
            if (!runtime) {
                await this.fabricEnvironmentHelper.createEnvironment(environmentName, undefined, true, capability);
                runtime = runtimeManager.getRuntime(environmentName);
            } else {
                const environmentEntry: FabricEnvironmentRegistryEntry = await FabricEnvironmentRegistry.instance().get(environmentName);
                await vscode.commands.executeCommand(ExtensionCommands.START_FABRIC, environmentEntry);
            }

            isRunning = await runtime.isRunning();
        }

        await runtime.waitFor();

        isRunning.should.equal(true);

        this.capability = (capability === UserInputUtil.V1_4_2 ? UserInputUtil.V1_4_2 : UserInputUtil.V2_0);
    });

    this.Given(`a 2 org local environment called '{string}' has been created with {string} capabilities`, this.timeout, async (environmentName: string, capability: string) => {
        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        const runtime: LocalMicroEnvironment = runtimeManager.getRuntime(environmentName);
        if (!runtime) {
            await this.fabricEnvironmentHelper.createEnvironment(environmentName, undefined, undefined, capability);
        }
    });

    this.Given("the '{string}' environment is connected", this.timeout, async (environment: string) => {
        await TimerUtil.sleep(3000);
        this.environmentName = environment;
        await this.fabricEnvironmentHelper.connectToEnvironment(environment);
        await TimerUtil.sleep(3000);
    });

    // this one
    this.Given(/(a local environment|an environment) '(.*?)' ?(?:of type '(.*?)')? ?(?:with (.*?) capabilities)? exists/, this.timeout, async (localString: string, environmentName: string, opsType: string, capability?: string) => {
        const args: any[] = [environmentName, opsType];
        const isLocal: boolean = localString === 'a local environment';
        args.push(isLocal);
        if (capability) {
            args.push(capability);
        }
        opsToolsAllNodesQuickPick = await this.fabricEnvironmentHelper.createEnvironment(...args);
        this.environmentName = environmentName;
        this.capability = (capability === UserInputUtil.V1_4_2 ? UserInputUtil.V1_4_2 : UserInputUtil.V2_0);
        await TimerUtil.sleep(3000);
    });

    this.Given('the environment is setup', this.timeout, async () => {
        const nodes: string[] = ['ca.example.com', 'orderer.example.com', 'peer0.org1.example.com'];
        let wallet: string;
        if (this.environmentName === 'v1Fabric') {
            wallet = 'v1Wallet';
        } else {
            wallet = this.environmentName === 'myFabric2' ? 'myWallet2' : 'myWallet';
        }

        let identity: string;
        for (const node of nodes) {
            if (node === 'ca.example.com') {
                identity = 'conga2';
            } else {
                identity = 'conga';
            }
            await this.fabricEnvironmentHelper.associateNodeWithIdentitiy(this.environmentName, node, identity, wallet);

        }
    });

    this.Given("the '{string}' opstools environment is setup", this.timeout, async (environmentType: string) => {
        const nodeMap: Map<string, string> = new Map<string, string>();
        let wallet: string;
        if (environmentType === 'software') {
            nodeMap.set('Ordering Service CA', 'OrderingServiceCAAdmin');
            nodeMap.set('Ordering Service_1', 'OrderingServiceMSPAdmin');
            nodeMap.set('Org1 CA', 'Org1CAAdmin');
            nodeMap.set('Org2 CA', 'Org2CAAdmin');
            nodeMap.set('Peer Org1', 'Org1MSPAdmin');
            nodeMap.set('Peer Org2', 'Org2MSPAdmin');
            wallet = 'opsToolsWallet';
        } else if (environmentType === 'SaaS') {
            nodeMap.set('Ordering Service CA', 'SaaSOrderingServiceCAAdmin');
            nodeMap.set('Ordering Service_1', 'SaaSOrderingServiceMSPAdmin');
            nodeMap.set('Org1 CA', 'SaaSOrg1CAAdmin');
            nodeMap.set('Peer Org1', 'SaaSOrg1MSPAdmin');
            wallet = 'SaaSOpsToolsWallet';
        }

        for (const node of nodeMap.entries()) {
            await this.fabricEnvironmentHelper.associateNodeWithIdentitiy(this.environmentName, node[0], node[1], wallet);
        }
    });

    this.Given("I have edited filters and imported all nodes to environment '{string}'", this.timeout, async (environmentName: string) => {
        await this.fabricEnvironmentHelper.editNodeFilters(opsToolsAllNodesQuickPick, environmentName);

    });

    this.Given('there are no IBM Cloud environments', this.timeout, async () => {
        const environments: FabricEnvironmentRegistryEntry[] = await FabricEnvironmentRegistry.instance().getAll();
        for (const env of environments) {
            if (env.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                await this.fabricEnvironmentHelper.deleteEnvironment(env.name);
            }
        }
    });

    /**
     * When
     */

    this.When(/I create an environment '(.*?)' ?(?:of type '(.*?)')?/, this.timeout, async (environmentName: string, opsType: string) => {
        opsToolsAllNodesQuickPick = await this.fabricEnvironmentHelper.createEnvironment(environmentName, opsType);
        await TimerUtil.sleep(3000);
    });

    this.When("I associate identity '{string}' in wallet '{string}' with node '{string}'", this.timeout, async (identity: string, wallet: string, node: string) => {
        await this.fabricEnvironmentHelper.associateNodeWithIdentitiy(this.environmentName, node, identity, wallet);
    });

    this.When("I connect to the environment '{string}'", this.timeout, async (environment: string) => {
        await this.fabricEnvironmentHelper.connectToEnvironment(environment);
        await TimerUtil.sleep(3000);
    });

    this.When("I delete node '{string}'", this.timeout, async (nodeName: string) => {
        await this.fabricEnvironmentHelper.deleteNode(nodeName, this.environmentName);
    });

    this.When("I hide the node '{string}'", this.timeout, async (nodeName: string) => {
        await this.fabricEnvironmentHelper.hideNode(nodeName, this.environmentName);
    });

    this.When("I delete an environment '{string}'", this.timeout, async (environmentName: string) => {
        await this.fabricEnvironmentHelper.deleteEnvironment(environmentName);
    });

    this.When(`I stop the ${FabricRuntimeUtil.LOCAL_FABRIC}`, this.timeout, async () => {
        await vscode.commands.executeCommand(ExtensionCommands.STOP_FABRIC);
        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        const runtime: LocalMicroEnvironment = runtimeManager.getRuntime(FabricRuntimeUtil.LOCAL_FABRIC);
        const isRunning: boolean = await runtime.isRunning();
        isRunning.should.equal(false);
    });

    this.When(`I start the ${FabricRuntimeUtil.LOCAL_FABRIC}`, this.timeout, async () => {
        await vscode.commands.executeCommand(ExtensionCommands.START_FABRIC);
        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        const runtime: LocalMicroEnvironment = runtimeManager.getRuntime(FabricRuntimeUtil.LOCAL_FABRIC);
        const isRunning: boolean = await runtime.isRunning();
        isRunning.should.equal(true);
    });

    this.When(`I teardown the ${FabricRuntimeUtil.LOCAL_FABRIC}`, this.timeout, async () => {
        await vscode.commands.executeCommand(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        const runtime: LocalMicroEnvironment = runtimeManager.getRuntime(FabricRuntimeUtil.LOCAL_FABRIC);
        const isRunning: boolean = await runtime.isRunning();
        isRunning.should.equal(false);
    });

    this.When("I edit filters and import all nodes to environment '{string}'", this.timeout, async (environmentName: string) => {
        await this.fabricEnvironmentHelper.editNodeFilters(opsToolsAllNodesQuickPick, environmentName);
    });

    this.When('I log in to IBM Cloud', this.timeout, async () => {
        await vscode.commands.executeCommand(ExtensionCommands.LOG_IN_AND_DISCOVER);
    });
};
