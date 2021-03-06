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

// tslint:disable max-classes-per-file
'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import { PeerTreeItem } from './runtimeOps/connectedTree/PeerTreeItem';
import { ChannelTreeItem } from './model/ChannelTreeItem';
import { BlockchainTreeItem } from './model/BlockchainTreeItem';
import { ImportNodesTreeItem } from './runtimeOps/connectedTree/ImportNodesTreeItem';
import { BlockchainExplorerProvider } from './BlockchainExplorerProvider';
import { RuntimeTreeItem } from './runtimeOps/disconnectedTree/RuntimeTreeItem';
import { VSCodeBlockchainOutputAdapter } from '../logging/VSCodeBlockchainOutputAdapter';
import { NodesTreeItem } from './runtimeOps/connectedTree/NodesTreeItem';
import { OrganizationsTreeItem } from './runtimeOps/connectedTree/OrganizationsTreeItem';
import { OrgTreeItem } from './runtimeOps/connectedTree/OrgTreeItem';
import { ExtensionCommands } from '../../ExtensionCommands';
import { CertificateAuthorityTreeItem } from './runtimeOps/connectedTree/CertificateAuthorityTreeItem';
import { OrdererTreeItem } from './runtimeOps/connectedTree/OrdererTreeItem';
import { FabricEnvironmentManager, ConnectedState } from '../fabric/environments/FabricEnvironmentManager';
import { FabricEnvironmentRegistry, FabricEnvironmentRegistryEntry, FabricNode, FabricNodeType, FabricRuntimeUtil, IFabricEnvironmentConnection, LogType, FabricEnvironment, EnvironmentType, FabricSmartContractDefinition } from 'ibm-blockchain-platform-common';
import { FabricEnvironmentTreeItem } from './runtimeOps/disconnectedTree/FabricEnvironmentTreeItem';
import { SetupTreeItem } from './runtimeOps/identitySetupTree/SetupTreeItem';
import { EnvironmentConnectedTreeItem } from './runtimeOps/connectedTree/EnvironmentConnectedTreeItem';
import { TextTreeItem } from './model/TextTreeItem';
import { EnvironmentFactory } from '../fabric/environments/EnvironmentFactory';
import { EditFiltersTreeItem } from './runtimeOps/connectedTree/EditFiltersTreeItem';
import { CommittedContractTreeItem } from './runtimeOps/connectedTree/CommittedSmartContractTreeItem';
import { DeployTreeItem } from './runtimeOps/connectedTree/DeployTreeItem';
import { EnvironmentGroupTreeItem } from './runtimeOps/EnvironmentGroupTreeItem';
import { ExtensionsInteractionUtil } from '../util/ExtensionsInteractionUtil';
import { SettingConfigurations } from '../configurations';
import { LocalMicroEnvironment } from '../fabric/environments/LocalMicroEnvironment';
import { LocalMicroEnvironmentManager } from '../fabric/environments/LocalMicroEnvironmentManager';

export class BlockchainEnvironmentExplorerProvider implements BlockchainExplorerProvider {

    // only for testing so can get the updated tree
    public tree: Array<BlockchainTreeItem> = [];

    // tslint:disable-next-line member-ordering
    private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();

    // tslint:disable-next-line member-ordering
    readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

    constructor() {
        FabricEnvironmentManager.instance().on('connected', async () => {
            await this.connect();
        });

        FabricEnvironmentManager.instance().on('disconnected', async () => {
            await this.disconnect();
        });
    }

    async refresh(element?: BlockchainTreeItem): Promise<void> {
        this._onDidChangeTreeData.fire(element);
    }

    async connect(): Promise<void> {
        await this.refresh();
    }

    async disconnect(): Promise<void> {
        // This controls which menu buttons appear
        await vscode.commands.executeCommand('setContext', 'blockchain-environment-connected', false);
        await this.refresh();
    }

    getTreeItem(element: BlockchainTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BlockchainTreeItem): Promise<BlockchainTreeItem[]> {
        if (element) {
            if (element instanceof EnvironmentGroupTreeItem) {
                this.tree = await this.populateEnvironments(element.environments);
            }
            if (element instanceof ChannelTreeItem) {
                this.tree = await this.createCommittedTree(element);
            }
            if (element instanceof NodesTreeItem) {
                this.tree = await this.createNodesTree();
            }
            if (element instanceof OrganizationsTreeItem) {
                this.tree = await this.createOrganizationsTree();
            }

        } else if (FabricEnvironmentManager.instance().getState() === ConnectedState.SETUP) {
            // need to do identity setup
            await vscode.commands.executeCommand('setContext', 'blockchain-environment-setup', true);
            const environmentRegistryEntry: FabricEnvironmentRegistryEntry = FabricEnvironmentManager.instance().getEnvironmentRegistryEntry();

            this.tree = await this.setupIdentities(environmentRegistryEntry);
        } else if (FabricEnvironmentManager.instance().getState() === ConnectedState.CONNECTING || FabricEnvironmentManager.instance().getState() === ConnectedState.CONNECTED) {
            const environmentRegistryEntry: FabricEnvironmentRegistryEntry = FabricEnvironmentManager.instance().getEnvironmentRegistryEntry();
            if (environmentRegistryEntry.managedRuntime) {
                await vscode.commands.executeCommand('setContext', 'blockchain-runtime-connected', true);
            } else {
                if (environmentRegistryEntry.environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT || environmentRegistryEntry.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                    if (FabricEnvironmentManager.instance().getState() === ConnectedState.CONNECTED) {
                        await vscode.commands.executeCommand(ExtensionCommands.CONNECT_TO_ENVIRONMENT, environmentRegistryEntry);
                        if (FabricEnvironmentManager.instance().getState() !== ConnectedState.DISCONNECTED) {
                            // If the user did not hide all nodes and therefore we are still connecting, update the tree
                            this.tree = await this.createConnectedTree(environmentRegistryEntry);
                        } else {
                            this.tree = await this.createConnectionTree();
                        }
                        return this.tree;
                    }
                    await vscode.commands.executeCommand('setContext', 'blockchain-opstool-connected', true);
                }

                await vscode.commands.executeCommand('setContext', 'blockchain-runtime-connected', false);
            }
            await vscode.commands.executeCommand('setContext', 'blockchain-environment-connected', true);
            await vscode.commands.executeCommand('setContext', 'blockchain-environment-setup', false);

            this.tree = await this.createConnectedTree(environmentRegistryEntry);
            if (FabricEnvironmentManager.instance().getState() === ConnectedState.CONNECTING) {
                FabricEnvironmentManager.instance().setState(ConnectedState.CONNECTED);
            }
        } else {
            await vscode.commands.executeCommand('setContext', 'blockchain-opstool-connected', false);
            await vscode.commands.executeCommand('setContext', 'blockchain-environment-setup', false);
            await vscode.commands.executeCommand('setContext', 'blockchain-runtime-connected', false);
            await vscode.commands.executeCommand('setContext', 'blockchain-environment-connected', false);

            this.tree = await this.createConnectionTree();
        }

        return this.tree;
    }

    private async setupIdentities(environmentRegistryEntry: FabricEnvironmentRegistryEntry): Promise<BlockchainTreeItem[]> {
        const tree: BlockchainTreeItem[] = [];

        const environment: FabricEnvironment = EnvironmentFactory.getEnvironment(environmentRegistryEntry);

        const nodes: FabricNode[] = await environment.getNodes(true);

        tree.push(new SetupTreeItem(this, `Setting up: ${environmentRegistryEntry.name}`));
        tree.push(new SetupTreeItem(this, ('(Click each node to perform setup)')));

        for (const node of nodes) {
            const command: vscode.Command = {
                command: ExtensionCommands.ASSOCIATE_IDENTITY_NODE,
                title: '',
                arguments: [environmentRegistryEntry, node]
            };

            let label: string = node.cluster_name || node.name;
            if (!node.wallet || !node.identity) {
                label += '   ⚠';
            }

            if (node.type === FabricNodeType.PEER) {
                const peerTreeItem: PeerTreeItem = new PeerTreeItem(this, label, node.name, environmentRegistryEntry, node, command);
                tree.push(peerTreeItem);
            }

            if (node.type === FabricNodeType.CERTIFICATE_AUTHORITY) {
                const certificateAuthorityTreeItem: CertificateAuthorityTreeItem = new CertificateAuthorityTreeItem(this, label, node.name, environmentRegistryEntry, node, command);
                tree.push(certificateAuthorityTreeItem);
            }

            if (node.type === FabricNodeType.ORDERER) {
                if (node.cluster_name) {
                    const foundTreeItem: BlockchainTreeItem = tree.find((treeItem: OrdererTreeItem) => treeItem.node && treeItem.node.type === FabricNodeType.ORDERER && node.cluster_name === treeItem.node.cluster_name);
                    if (!foundTreeItem) {
                        tree.push(new OrdererTreeItem(this, label, node.cluster_name, environmentRegistryEntry, node, command));
                    }
                } else {
                    tree.push(new OrdererTreeItem(this, label, node.name, environmentRegistryEntry, node, command));
                }
            }
        }

        return tree;
    }

    private async createConnectionTree(): Promise<BlockchainTreeItem[]> {
        const tree: BlockchainTreeItem[] = [];

        const environmentEntries: FabricEnvironmentRegistryEntry[] = await FabricEnvironmentRegistry.instance().getAll();

        const environmentGroups: Array<FabricEnvironmentRegistryEntry[]> = [];
        const cloudEnvironments: Array<FabricEnvironmentRegistryEntry> = [];
        const otherEnvironments: Array<FabricEnvironmentRegistryEntry> = [];
        for (const environment of environmentEntries) {
            if (environmentGroups.length === 0) {
                if (environment.environmentType === EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT) {
                    environmentGroups.push([environment]);
                } else if (environment.environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT || environment.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                    cloudEnvironments.push(environment);
                } else {
                    otherEnvironments.push(environment);
                }
                continue;
            }

            // Used to check if group exists already
            const groupIndex: number = environmentGroups.findIndex((group: FabricEnvironmentRegistryEntry[]) => {
                return group[0].environmentType === environment.environmentType;
            });

            if (groupIndex !== -1) {
                // If a group with the same environmentType exists, then push gateway to the group
                environmentGroups[groupIndex].push(environment);
            } else { // if there's a local env that group will have been created first, so check for other env types
                if (environment.environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT || environment.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                    cloudEnvironments.push(environment);
                } else {
                    // group environments that aren't local or opstools
                    otherEnvironments.push(environment);
                }
            }
        }

        if (cloudEnvironments.length > 0) {
            environmentGroups.push(cloudEnvironments);
        }

        if (otherEnvironments.length > 0) {
            environmentGroups.push(otherEnvironments);
        }

        if (environmentGroups.length === 0) {
            const command: vscode.Command = {
                command: ExtensionCommands.ADD_ENVIRONMENT,
                title: '',
                arguments: []
            };

            tree.push(new TextTreeItem(this, '+ Add local or remote environment', command));

            // if there are no environments at all we should still show the option to log in to IBM Cloud
            const treeItem: EnvironmentGroupTreeItem = await this.getIBMCloudInteractionItem(true) as EnvironmentGroupTreeItem;
            if (treeItem) {
                tree.push(treeItem);
            }
        } else {
            for (const group of environmentGroups) {
                let groupName: string = '';
                if (group[0].environmentType === EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT) {
                    groupName = 'Simple local networks';
                } else if (group[0].environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT || group[0].environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                    groupName = 'IBM Blockchain Platform on cloud';
                } else {
                    groupName = 'Other networks';
                }
                tree.push(new EnvironmentGroupTreeItem(this, groupName, group, vscode.TreeItemCollapsibleState.Expanded));
            }
            if (!tree.some((treeItem: BlockchainTreeItem) => treeItem.label === 'IBM Blockchain Platform on cloud' )) {
                const treeItem: EnvironmentGroupTreeItem = await this.getIBMCloudInteractionItem(true) as EnvironmentGroupTreeItem;
                if (treeItem) {
                    tree.push(treeItem);
                    tree.sort((a: EnvironmentGroupTreeItem, b: EnvironmentGroupTreeItem): number => {
                        if (a.label !== 'Simple local networks' && b.label !== 'Simple local networks') {
                            return a.label.localeCompare(b.label);
                        }
                    });
                }
            }
        }

        return tree;
    }

    private async populateEnvironments(environments: FabricEnvironmentRegistryEntry[]): Promise<Array<BlockchainTreeItem>> {
        const outputAdapter: VSCodeBlockchainOutputAdapter = VSCodeBlockchainOutputAdapter.instance();

        try {
            const tree: Array<BlockchainTreeItem> = [];

            if (environments.length === 0) {
                tree.push(await this.getIBMCloudInteractionItem(false) as TextTreeItem);
            } else {
                // if there are no saas environments in the cloud group we should add the log in tree item
                if (environments[0].environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT) {
                    if (!environments.some((environment: FabricEnvironmentRegistryEntry) => environment.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT)) {
                        const treeItem: TextTreeItem = await this.getIBMCloudInteractionItem(false) as TextTreeItem;
                        if (treeItem) {
                            tree.push(treeItem);
                        }
                    }
                }

                for (const environment of environments) {
                    if (environment.managedRuntime) {
                        const runtime: LocalMicroEnvironment = await LocalMicroEnvironmentManager.instance().ensureRuntime(environment.name, undefined, environment.numberOfOrgs);

                        const treeItem: RuntimeTreeItem = await RuntimeTreeItem.newRuntimeTreeItem(this,
                            runtime.getName(),
                            environment,
                            {
                                command: ExtensionCommands.CONNECT_TO_ENVIRONMENT,
                                title: '',
                                arguments: [environment]
                            },
                            runtime
                        );

                        const isRunning: boolean = await runtime.isRunning();
                        if (isRunning) {
                            treeItem.contextValue = 'blockchain-runtime-item-running';
                        }

                        treeItem.iconPath = {
                            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'laptop.svg'),
                            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'laptop.svg')
                        };

                        tree.push(treeItem);

                    } else {
                        const environmentTreeItem: FabricEnvironmentTreeItem = new FabricEnvironmentTreeItem(this,
                            environment.name,
                            environment,
                            {
                                command: ExtensionCommands.CONNECT_TO_ENVIRONMENT,
                                title: '',
                                arguments: [environment]
                            }
                        );

                        if (environment.environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT || environment.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                            environmentTreeItem.iconPath = {
                                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'ibm-cloud.svg'),
                                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'ibm-cloud.svg')
                            };
                            environmentTreeItem.contextValue = 'blockchain-ops-environment';
                        }

                        tree.push(environmentTreeItem);
                    }
                }
            }

            return tree;
        } catch (error) {
            outputAdapter.log(LogType.ERROR, `Error populating Fabric Environment Panel: ${error.message}`, `Error populating Fabric Environment Panel: ${error.toString()}`);
        }
    }

    private async getIBMCloudInteractionItem(returnGroupItem: boolean): Promise<BlockchainTreeItem> {
        const ibmCloudExtensionInstalled: boolean = ExtensionsInteractionUtil.isIBMCloudExtensionInstalled();
        if (!ibmCloudExtensionInstalled) {
            if (returnGroupItem) {
                return new EnvironmentGroupTreeItem(this, 'IBM Blockchain Platform on cloud', [], vscode.TreeItemCollapsibleState.Expanded);
            } else {
                const label: string = '+ Install IBM Cloud Account extension';
                const command: vscode.Command = {
                    command: ExtensionCommands.OPEN_VSCODE_EXTENSION,
                    title: '',
                    arguments: []
                };
                return new TextTreeItem(this, label, command);
            }
        }

        const isLoggedIn: boolean = await ExtensionsInteractionUtil.cloudAccountIsLoggedIn();
        const hasAccountSelected: boolean = await ExtensionsInteractionUtil.cloudAccountHasSelectedAccount();
        if ( !isLoggedIn || !hasAccountSelected) {
            if (returnGroupItem) {
                return new EnvironmentGroupTreeItem(this, 'IBM Blockchain Platform on cloud', [], vscode.TreeItemCollapsibleState.Expanded);
            } else {
                const label: string = !isLoggedIn ? '+ Log in to IBM Cloud' : '+ Select IBM Cloud account';
                const command: vscode.Command = {
                    command: ExtensionCommands.LOG_IN_AND_DISCOVER,
                    title: '',
                    arguments: []
                };
                return new TextTreeItem(this, label, command);
            }
        } else {
            // if we're logged in we need to figure out if they've got stuff stood up on IBP, and if they dont show the tree item
            const anyIbpResources: boolean = await ExtensionsInteractionUtil.cloudAccountAnyIbpResources();
            if (anyIbpResources) {
                // we should try and automatically add the environments for them
                const shouldDiscover: boolean = vscode.workspace.getConfiguration().get(SettingConfigurations.DISCOVER_SAAS_ENVS);
                if (shouldDiscover === true) {
                    await vscode.commands.executeCommand(ExtensionCommands.LOG_IN_AND_DISCOVER);
                }
            } else {
                if (returnGroupItem) {
                    return new EnvironmentGroupTreeItem(this, 'IBM Blockchain Platform on cloud', [], vscode.TreeItemCollapsibleState.Expanded);
                } else {
                    const command: vscode.Command = {
                        command: ExtensionCommands.OPEN_NEW_INSTANCE_LINK,
                        title: '',
                        arguments: []
                    };
                    return new TextTreeItem(this, '+ create new instance', command);
                }
            }
        }
    }

    private async createConnectedTree(environmentRegistryEntry: FabricEnvironmentRegistryEntry): Promise<Array<BlockchainTreeItem>> {
        const tree: Array<BlockchainTreeItem> = [];

        const name: string = environmentRegistryEntry.name;

        tree.push(new EnvironmentConnectedTreeItem(this, `Connected to environment: ${name}`));

        const channels: BlockchainTreeItem[] = await this.createChannelsTree();

        tree.push(...channels);

        tree.push(new NodesTreeItem(this, vscode.TreeItemCollapsibleState.Collapsed));

        tree.push(new OrganizationsTreeItem(this, vscode.TreeItemCollapsibleState.Collapsed));

        return tree;
    }

    private async createChannelsTree(): Promise<Array<BlockchainTreeItem>> {
        const outputAdapter: VSCodeBlockchainOutputAdapter = VSCodeBlockchainOutputAdapter.instance();
        const tree: Array<BlockchainTreeItem> = [];
        const connection: IFabricEnvironmentConnection = FabricEnvironmentManager.instance().getConnection();

        try {
            const channelMap: Map<string, Array<string>> = await connection.createChannelMap();
            const channels: Array<string> = Array.from(channelMap.keys());

            for (const channel of channels) {
                const peers: Array<string> = channelMap.get(channel);

                const smartContracts: FabricSmartContractDefinition[] = await connection.getCommittedSmartContractDefinitions(peers, channel);

                const capability: string[] = await connection.getChannelCapabilityFromPeer(channel, peers[0]);
                tree.push(new ChannelTreeItem(this, channel, peers, smartContracts, capability[0], vscode.TreeItemCollapsibleState.Collapsed));
            }
        } catch (error) {
            outputAdapter.log(LogType.ERROR, `Error populating channel view: ${error.message}`, `Error populating channel view: ${error.toString()}`);
            return tree;
        }
        return tree;
    }

    private async createCommittedTree(element: ChannelTreeItem): Promise<BlockchainTreeItem[]> {
        const tree: Array<BlockchainTreeItem> = [];

        for (const smartContract of element.chaincodes) {
            tree.push(new CommittedContractTreeItem(this, `${smartContract.name}@${smartContract.version}`));
        }

        const fabricEnvironmentRegistryEntry: FabricEnvironmentRegistryEntry = FabricEnvironmentManager.instance().getEnvironmentRegistryEntry();

        const command: vscode.Command = {
            command: ExtensionCommands.OPEN_DEPLOY_PAGE,
            title: '',
            arguments: [fabricEnvironmentRegistryEntry, element.label]
        };

        tree.push(new DeployTreeItem(this, command));

        return tree;
    }

    private async createNodesTree(): Promise<Array<BlockchainTreeItem>> {
        const outputAdapter: VSCodeBlockchainOutputAdapter = VSCodeBlockchainOutputAdapter.instance();
        const tree: Array<BlockchainTreeItem> = [];

        try {
            const connection: IFabricEnvironmentConnection = FabricEnvironmentManager.instance().getConnection();
            const environmentRegistryEntry: FabricEnvironmentRegistryEntry = FabricEnvironmentManager.instance().getEnvironmentRegistryEntry();
            const peerNames: Array<string> = connection.getAllPeerNames();

            for (const peerName of peerNames) {
                const node: FabricNode = connection.getNode(peerName);
                const tooltip: string = `Name: ${node.name}\nMSPID: ${node.msp_id}\nAssociated Identity:\n${node.identity}`;
                const peerTreeItem: PeerTreeItem = new PeerTreeItem(this, peerName, tooltip, environmentRegistryEntry, node);
                tree.push(peerTreeItem);
            }

            // Push Certificate Authority tree item
            const certificateAuthorityNames: Array<string> = connection.getAllCertificateAuthorityNames();
            for (const certificateAuthorityName of certificateAuthorityNames) {
                const node: FabricNode = connection.getNode(certificateAuthorityName);
                const tooltip: string = `Name: ${node.name}\nAssociated Identity:\n${node.identity}`;
                const caTreeItem: CertificateAuthorityTreeItem = new CertificateAuthorityTreeItem(this, certificateAuthorityName, tooltip, environmentRegistryEntry, node);
                tree.push(caTreeItem);
            }

            const ordererNames: Array<string> = connection.getAllOrdererNames();

            for (const ordererName of ordererNames) {
                const node: FabricNode = connection.getNode(ordererName);
                if (node.cluster_name) {
                    const foundTreeItem: BlockchainTreeItem = tree.find((treeItem: OrdererTreeItem) => node.type === FabricNodeType.ORDERER && node.cluster_name === treeItem.node.cluster_name);
                    if (!foundTreeItem) {
                        const tooltip: string = `Name: ${node.cluster_name}\nMSPID: ${node.msp_id}\nAssociated Identity:\n${node.identity}`;
                        tree.push(new OrdererTreeItem(this, node.cluster_name, tooltip, environmentRegistryEntry, node));
                    }
                } else {
                    const tooltip: string = `Name: ${node.name}\nMSPID: ${node.msp_id}\nAssociated Identity:\n${node.identity}`;
                    tree.push(new OrdererTreeItem(this, node.name, tooltip, environmentRegistryEntry, node));
                }
            }

            const environmentEntry: FabricEnvironmentRegistryEntry = FabricEnvironmentManager.instance().getEnvironmentRegistryEntry();

            if (environmentEntry.name !== FabricRuntimeUtil.LOCAL_FABRIC) {

                if (environmentEntry.environmentType === EnvironmentType.OPS_TOOLS_ENVIRONMENT || environmentEntry.environmentType === EnvironmentType.SAAS_OPS_TOOLS_ENVIRONMENT) {
                    tree.push(new EditFiltersTreeItem(this, {
                        command: ExtensionCommands.EDIT_NODE_FILTERS,
                        title: '',
                        arguments: [environmentEntry],
                    }));
                } else {
                    tree.push(new ImportNodesTreeItem(this, {
                        command: ExtensionCommands.IMPORT_NODES_TO_ENVIRONMENT,
                        title: '',
                        arguments: [environmentEntry]
                    }));
                }
            }

        } catch (error) {
            outputAdapter.log(LogType.ERROR, `Error populating nodes view: ${error.message}`, `Error populating nodes view: ${error.toString()}`);
            return tree;
        }
        return tree;

    }

    private async createOrganizationsTree(): Promise<Array<BlockchainTreeItem>> {
        const connection: IFabricEnvironmentConnection = FabricEnvironmentManager.instance().getConnection();
        const orgNames: string[] = connection.getAllOrganizationNames();
        return orgNames.map((organizationName: string) => new OrgTreeItem(this, organizationName));
    }

}
