import React, { Component } from 'react';
import HeadingCombo from '../../elements/HeadingCombo/HeadingCombo';
import './DeployPage.scss';
import ButtonList from '../../elements/ButtonList/ButtonList';
import DeployProgressBar from '../../elements/DeployProgressBar/DeployProgressBar';
import { Link, Dropdown, Accordion, AccordionItem } from 'carbon-components-react';
import IPackageRegistryEntry from '../../../interfaces/IPackageRegistryEntry';
import DeployStepOne from '../../elements/DeploySteps/DeployStepOne/DeployStepOne';
import DeployStepTwo from '../../elements/DeploySteps/DeployStepTwo/DeployStepTwo';
import DeployStepThree from '../../elements/DeploySteps/DeployStepThree/DeployStepThree';

interface IProps {
    deployData: {channelName: string, environmentName: string, packageEntries: IPackageRegistryEntry[]};
}

interface DeployState {
    channelName: string;
    environmentName: string;
    progressIndex: number;
    selectedPackage: IPackageRegistryEntry | undefined;
    definitionName: string;
    definitionVersion: string;
    disableNext: boolean;
}

class DeployPage extends Component<IProps, DeployState> {

    constructor(props: Readonly<IProps>) {
        super(props);
        this.state = {
            channelName: this.props.deployData.channelName,
            environmentName: this.props.deployData.environmentName,
            progressIndex: 0,
            selectedPackage: undefined,
            definitionName: '',
            definitionVersion: '',
            disableNext: true
        };

        this.handleProgressChange = this.handleProgressChange.bind(this);
        this.handlePackageChange = this.handlePackageChange.bind(this);
        this.handleDefinitionNameChange = this.handleDefinitionNameChange.bind(this);
        this.handleDefinitionVersionChange = this.handleDefinitionVersionChange.bind(this);
    }

    handleProgressChange(indexValue: number): void {
        const newState: any = {progressIndex: indexValue};

        if (newState.progressIndex === 0 && this.state.selectedPackage) {
            newState.disableNext = false;
        }

        this.setState(newState);
    }

    handlePackageChange(selectedPackage: IPackageRegistryEntry): void {
        this.setState({selectedPackage, definitionName: '', definitionVersion: '', disableNext: false}); // Reset definition name and version back to default.
    }

    handleDefinitionNameChange(definitionName: string): void {
        // Disable Next button if name is undefined
        this.setState({definitionName, disableNext: !definitionName});
    }
    handleDefinitionVersionChange(definitionVersion: string): void {
        // Disable Next button if version is undefined
        this.setState({definitionVersion, disableNext: !definitionVersion});
    }

    render(): JSX.Element {

        const subHeadingString: string = `Deploying to ${this.state.channelName} in ${this.state.environmentName}`;

        const currentIndex: number = this.state.progressIndex;

        let currentStepComponent: any;
        // Render components depending on the progress / step.
        if (currentIndex === 0) {
            currentStepComponent = <DeployStepOne packageEntries={this.props.deployData.packageEntries} selectedPackage={this.state.selectedPackage} onPackageChange={this.handlePackageChange}/>;
        } else if (currentIndex === 1) {
            currentStepComponent = <DeployStepTwo selectedPackage={this.state.selectedPackage as IPackageRegistryEntry} currentDefinitionName={this.state.definitionName} currentDefinitionVersion={this.state.definitionVersion} onDefinitionNameChange={this.handleDefinitionNameChange} onDefinitionVersionChange={this.handleDefinitionVersionChange}/>;
        } else {
            currentStepComponent = <DeployStepThree selectedPackage={this.state.selectedPackage as IPackageRegistryEntry} channelName={this.state.channelName}/>;
        }

        return (
            <div className='bx--grid deploy-page-container'>
                <div className='bx--row'>
                    <div className='bx--col-lg-10'>
                        <HeadingCombo
                            headingText='Deploy smart contract'
                            subheadingText={subHeadingString}
                        />
                    </div>
                    <div className='bx--col-lg-4'>
                        <ButtonList onProgressChange={this.handleProgressChange} currentIndex={this.state.progressIndex} disableNext={this.state.disableNext}/>
                    </div>
                    <div className='bx--col-lg-2'></div>
                </div>
                <div className='bx--row progress-row'>
                    <DeployProgressBar currentIndex={this.state.progressIndex}/>
                </div>

                {currentStepComponent}

            </div>

        );
    }
}

export default DeployPage;