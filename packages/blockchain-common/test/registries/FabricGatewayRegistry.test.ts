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

import { FabricGatewayRegistry } from '../../src/registries/FabricGatewayRegistry';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FabricGatewayRegistryEntry } from '../../src/registries/FabricGatewayRegistryEntry';
import { FabricRuntimeUtil } from '../../src/util/FabricRuntimeUtil';
import { FabricEnvironmentRegistry } from '../../src/registries/FabricEnvironmentRegistry';
import { FabricEnvironmentRegistryEntry, EnvironmentType } from '../../src/registries/FabricEnvironmentRegistryEntry';
import { MicrofabEnvironment } from '../../src/environments/MicrofabEnvironment';

// tslint:disable no-unused-expression
chai.should();
chai.use(chaiAsPromised);

describe('FabricGatewayRegistry', () => {

    const registry: FabricGatewayRegistry = FabricGatewayRegistry.instance();
    const environmentRegistry: FabricEnvironmentRegistry = FabricEnvironmentRegistry.instance();
    let sandbox: sinon.SinonSandbox;

    before(async () => {
        const registryPath: string = path.join(__dirname, 'tmp', 'registries');
        registry.setRegistryPath(registryPath);
        environmentRegistry.setRegistryPath(registryPath);
    });

    beforeEach(async () => {
        await registry.clear();
        await environmentRegistry.clear();
        sandbox = sinon.createSandbox();
    });

    afterEach(async () => {
        await registry.clear();
        await environmentRegistry.clear();
        sandbox.restore();
    });

    it('should get all the gateways and put local microfabs first', async () => {
        const gatewayOne: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({
            name: 'gatewayOne',
            associatedWallet: '',
            connectionProfilePath: path.join('myPath', 'connection.json')
        });

        await registry.getAll().should.eventually.deep.equal([]);

        await FabricEnvironmentRegistry.instance().add({ name: FabricRuntimeUtil.LOCAL_FABRIC, environmentDirectory: '', environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT, numberOfOrgs: 1, managedRuntime: true,  url: 'http://someurl:9000', fabricCapabilities: 'V2_0' });
        await FabricEnvironmentRegistry.instance().add({ name: 'otherLocalEnv', environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT, managedRuntime: true, environmentDirectory: '', numberOfOrgs: 1,  url: 'http://anotherurl:9000', fabricCapabilities: 'V2_0' });

        const localFabricEntry: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({ name: FabricRuntimeUtil.LOCAL_FABRIC, fromEnvironment: FabricRuntimeUtil.LOCAL_FABRIC, associatedWallet: 'Org1', displayName: `Org1`, connectionProfilePath: path.join('localFabric', 'connection.json') });
        const otherLocalEntry: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({ name: 'otherLocal', fromEnvironment: 'otherLocalEnv', associatedWallet: 'Org1', displayName: `Org1`, connectionProfilePath: path.join('localFabric', 'connection.json') });

        await registry.add(gatewayOne);
        await registry.add(localFabricEntry);
        await registry.add(otherLocalEntry);

        const gateways: FabricGatewayRegistryEntry[] = await registry.getAll();
        gateways.should.deep.equal([localFabricEntry, otherLocalEntry, gatewayOne]);
    }).timeout(35000);

    it('should get all gateways but not show local fabric', async () => {
        const gatewayOne: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({
            name: 'gatewayOne',
            associatedWallet: '',
            connectionProfilePath: path.join('myPath', 'connection.json')
        });

        await registry.getAll().should.eventually.deep.equal([]);

        await FabricEnvironmentRegistry.instance().add({ name: FabricRuntimeUtil.LOCAL_FABRIC, environmentDirectory: '', environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT, managedRuntime: true, url: 'http://someurl:9000', fabricCapabilities: 'V2_0' });
        await FabricEnvironmentRegistry.instance().add({ name: 'otherLocalEnv', environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT, managedRuntime: true, environmentDirectory: '',  url: 'http://anotherurl:9000', fabricCapabilities: 'V2_0' });

        const localFabricEntry: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({ name: FabricRuntimeUtil.LOCAL_FABRIC, fromEnvironment: FabricRuntimeUtil.LOCAL_FABRIC, associatedWallet: 'Org1', displayName: `Org1`, connectionProfilePath: path.join('localFabric', 'connection.json') });
        const otherLocalEntry: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({ name: 'otherLocal', fromEnvironment: 'otherLocalEnv', associatedWallet: 'Org1', displayName: `Org1`, connectionProfilePath: path.join('localFabric', 'connection.json') });

        await registry.add(gatewayOne);
        await registry.add(localFabricEntry);
        await registry.add(otherLocalEntry);
        await registry.getAll(false).should.eventually.deep.equal([gatewayOne]);
    });

    it('should get all including environments ones', async () => {
        const gatewayOne: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({
            name: 'gatewayOne',
            associatedWallet: '',
            connectionProfilePath: path.join('myPath', 'connection.json')
        });

        await registry.getAll().should.eventually.deep.equal([]);

        await registry.add(gatewayOne);

        await environmentRegistry.add(new FabricEnvironmentRegistryEntry({
            name: 'microfabEnvironment',
            environmentDirectory: path.join('test', 'data', 'microfab'),
            environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT,
            managedRuntime: true,
            url: 'http://console.microfab.example.org',
            fabricCapabilities: 'V2_0'
        }));

        const newMicrofabEnvironmentStub: sinon.SinonStub = sandbox.stub(FabricGatewayRegistry.instance(), 'newMicrofabEnvironment');
        const mockMicrofabEnvironment: sinon.SinonStubbedInstance<MicrofabEnvironment> = sinon.createStubInstance(MicrofabEnvironment);
        mockMicrofabEnvironment.isAlive.resolves(true);
        mockMicrofabEnvironment.getGateways.resolves([
            {
                name: 'microfabEnvironment - myGateway'
            }
        ]);
        newMicrofabEnvironmentStub.callsFake((name: string, directory: string, url: string): sinon.SinonStubbedInstance<MicrofabEnvironment> => {
            newMicrofabEnvironmentStub['wrappedMethod'](name, directory, url);
            return mockMicrofabEnvironment;
        });

        const entries: FabricGatewayRegistryEntry[] = await FabricGatewayRegistry.instance().getAll();

        entries.length.should.equal(2);
        entries[0].should.deep.equal(gatewayOne);
        entries[1].name.should.equal('microfabEnvironment - myGateway');
    });

    it('should get all including environments ones but excluding Microfab ones that are not alive', async () => {
        const gatewayOne: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({
            name: 'gatewayOne',
            associatedWallet: '',
            connectionProfilePath: path.join('myPath', 'connection.json')
        });

        await registry.getAll().should.eventually.deep.equal([]);

        await registry.add(gatewayOne);

        await environmentRegistry.add(new FabricEnvironmentRegistryEntry({
            name: 'microfabEnvironment',
            environmentDirectory: path.join('test', 'data', 'microfab'),
            environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT,
            managedRuntime: false,
            url: 'http://console.microfab.example.org'
        }));

        const newMicrofabEnvironmentStub: sinon.SinonStub = sandbox.stub(FabricGatewayRegistry.instance(), 'newMicrofabEnvironment');
        const mockMicrofabEnvironment: sinon.SinonStubbedInstance<MicrofabEnvironment> = sinon.createStubInstance(MicrofabEnvironment);
        mockMicrofabEnvironment.isAlive.resolves(false);
        mockMicrofabEnvironment.getGateways.rejects(new Error('should not be called'));
        newMicrofabEnvironmentStub.callsFake((name: string, directory: string, url: string): sinon.SinonStubbedInstance<MicrofabEnvironment> => {
            newMicrofabEnvironmentStub['wrappedMethod'](name, directory, url);
            return mockMicrofabEnvironment;
        });

        const entries: FabricGatewayRegistryEntry[] = await FabricGatewayRegistry.instance().getAll();

        entries.length.should.equal(1);
        entries[0].should.deep.equal(gatewayOne);
    });

    it('should update an unmanaged gateway', async () => {
        const gatewayOne: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({
            name: 'gatewayOne',
            associatedWallet: '',
            connectionProfilePath: path.join('localFabric', 'connection.json')
        });

        await registry.getAll().should.eventually.deep.equal([]);

        await registry.add(gatewayOne);

        const transactionDataDirectories: Array<{ chaincodeName: string, channelName: string, transactionDataPath: string }> = [{
            chaincodeName: 'mySmartContract',
            channelName: 'myChannel',
            transactionDataPath: 'my/transaction/data/path'
        }];

        gatewayOne.transactionDataDirectories = transactionDataDirectories;

        await registry.update(gatewayOne);

        await registry.getAll(false).should.eventually.deep.equal([gatewayOne]);
    });

    it('should update a gateway in a managed environment', async () => {
        const writeFileStub: sinon.SinonStub = sinon.stub(fs, 'writeJson');

        const gatewayOne: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry({
            name: 'gatewayOne',
            associatedWallet: '',
            connectionProfilePath: path.join('localFabric', 'connection.json')
        });

        await registry.getAll().should.eventually.deep.equal([]);

        await registry.add(gatewayOne);

        gatewayOne.fromEnvironment = 'myEnvironment';
        gatewayOne.connectionProfilePath = 'my/connection/profile/path';
        gatewayOne.transactionDataDirectories = [{
            chaincodeName: 'mySmartContract',
            channelName: 'myChannel',
            transactionDataPath: 'my/transaction/data/path'
        }];

        await registry.update(gatewayOne);

        writeFileStub.should.have.been.called;
    });
});
