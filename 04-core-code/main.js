// File: 04-core-code/main.js

import { AppContext } from './app-context.js';
import { MigrationService } from './services/migration-service.js';
import { UIManager } from './ui/ui-manager.js';
import { InputHandler } from './ui/input-handler.js';
import { paths } from './config/paths.js';
import { EVENTS, DOM_IDS } from './config/constants.js';
import { LeftPanelComponent } from './ui/left-panel-component.js';

class App {
    constructor() {
        this.appContext = new AppContext();
        const migrationService = new MigrationService();
        const restoredData = migrationService.loadAndMigrateData();
        this.appContext.initialize(restoredData);
    }

    async _loadPartials() {
        const eventAggregator = this.appContext.get('eventAggregator');
        const loadPartial = async (url, targetElement, injectionMethod = 'append') => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${url}`);
                const html = await response.text();
                if (injectionMethod === 'innerHTML') targetElement.innerHTML = html;
                else targetElement.insertAdjacentHTML('beforeend', html);
            } catch (error) {
                console.error(`Failed to load HTML partial from ${url}:`, error);
                eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Error: Could not load UI component from ${url}!`, type: 'error' });
            }
        };

        await loadPartial(paths.partials.leftPanel, document.body);
        const functionPanel = document.getElementById(DOM_IDS.FUNCTION_PANEL);
        if (functionPanel) {
            await loadPartial(paths.partials.rightPanel, functionPanel, 'innerHTML');
        }
    }

    async run() {
        console.log("Application starting...");

        await this._loadPartials();
        this.appContext.initializeUIComponents();

        const eventAggregator = this.appContext.get('eventAggregator');
        const calculationService = this.appContext.get('calculationService');
        const configManager = this.appContext.get('configManager');
        const appController = this.appContext.get('appController');

        // [REFACTOR] Implement the correct Dependency Injection pattern
        // Step 1: Find the DOM element AFTER it has been loaded.
        const leftPanelElement = document.getElementById(DOM_IDS.LEFT_PANEL);
        if (!leftPanelElement) {
            throw new Error("Fatal Error: The #left-panel element could not be found after loading partials.");
        }

        // Step 2: Create the component instance by INJECTING the DOM element.
        const leftPanelComponent = new LeftPanelComponent({
            panelElement: leftPanelElement, // Inject the actual element
            eventAggregator,
            detailConfigView: this.appContext.get('detailConfigView')
        });

        // Step 3: Pass the fully initialized component to the UIManager.
        this.uiManager = new UIManager({
            appElement: document.getElementById(DOM_IDS.APP),
            eventAggregator,
            calculationService,
            rightPanelComponent: this.appContext.get('rightPanelComponent'),
            quotePreviewComponent: this.appContext.get('quotePreviewComponent'),
            leftPanelComponent: leftPanelComponent
        });

        await configManager.initialize();
        eventAggregator.subscribe(EVENTS.STATE_CHANGED, (state) => this.uiManager.render(state));
        appController.publishInitialState();
        this.inputHandler = new InputHandler(eventAggregator);
        this.inputHandler.initialize();

        eventAggregator.subscribe(EVENTS.APP_READY, () => {
            setTimeout(() => {
                eventAggregator.publish(EVENTS.FOCUS_CELL, { rowIndex: 0, column: 'width' });
            }, 100);
        });

        eventAggregator.publish(EVENTS.APP_READY);
        console.log("Application running and interactive.");
        document.body.classList.add('app-is-ready');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.run();
});