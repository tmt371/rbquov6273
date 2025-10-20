// File: 04-core-code/ui/ui-manager.js

import { TableComponent } from './table-component.js';
import { SummaryComponent } from './summary-component.js';
import { PanelComponent } from './panel-component.js';
import { NotificationComponent } from './notification-component.js';
import { DialogComponent } from './dialog-component.js';
import { DOM_IDS, EVENTS } from '../config/constants.js';

/**
 * @fileoverview Manages all UI components and their rendering based on state changes.
 * Acts as the central hub for UI updates.
 */
export class UIManager {
    constructor({
        appElement,
        eventAggregator,
        calculationService,
        rightPanelComponent,
        quotePreviewComponent,
        leftPanelComponent // [MODIFIED] Receive an already instantiated component
    }) {
        this.appElement = appElement;
        this.eventAggregator = eventAggregator;
        this.calculationService = calculationService;

        // --- Child Component Management ---
        this.tableComponent = new TableComponent(
            document.getElementById(DOM_IDS.RESULTS_TABLE),
            eventAggregator
        );
        this.summaryComponent = new SummaryComponent(
            document.getElementById(DOM_IDS.TOTAL_SUM_VALUE)
        );
        // [MODIFIED] Assign the received instance directly
        this.leftPanelComponent = leftPanelComponent;
        this.rightPanelComponent = rightPanelComponent;
        this.numericKeyboardPanel = new PanelComponent(
            document.getElementById(DOM_IDS.NUMERIC_KEYBOARD_PANEL)
        );
        this.notificationComponent = new NotificationComponent(
            document.getElementById(DOM_IDS.TOAST_CONTAINER),
            eventAggregator
        );
        this.dialogComponent = new DialogComponent(
            document.getElementById(DOM_IDS.CONFIRMATION_DIALOG_OVERLAY),
            eventAggregator
        );
        this.quotePreviewComponent = quotePreviewComponent;

        // --- Event Subscriptions ---
        this.eventAggregator.subscribe(EVENTS.USER_TOGGLED_NUMERIC_KEYBOARD, (isVisible) =>
            this.toggleNumericKeyboard(isVisible)
        );
    }

    render(state) {
        // Delegate rendering to child components
        this.tableComponent.render(state);
        this.summaryComponent.render(state, this.calculationService);
        this.leftPanelComponent.render(state);
        this.rightPanelComponent.render(state);

        this.numericKeyboardPanel.render(state.ui.isNumericKeyboardVisible);
    }

    toggleNumericKeyboard(isVisible) {
        const panelToggle = document.getElementById(DOM_IDS.PANEL_TOGGLE);
        this.numericKeyboardPanel.toggle(isVisible);
        if (isVisible) {
            panelToggle.classList.add('is-active');
        } else {
            panelToggle.classList.remove('is-active');
        }
    }
}