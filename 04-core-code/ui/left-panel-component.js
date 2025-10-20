// File: 04-core-code/ui/left-panel-component.js

import { LeftPanelInputHandler } from './left-panel-input-handler.js';
import { DOM_IDS, EVENTS } from '../config/constants.js';

/**
 * @fileoverview Manages the left-side panel, including its visibility
 * and the interactions within its various tabs (K1, K2, etc.).
 */
export class LeftPanelComponent {
    constructor({ eventAggregator, detailConfigView }) {
        // [REFACTOR] The panelElement is now injected directly by the creator (main.js)
        // This removes the fragile dependency on the DOM being ready at construction time.
        this.panelElement = document.getElementById(DOM_IDS.LEFT_PANEL);
        if (!this.panelElement) {
            // This check is a safeguard, but the new architecture in main.js should prevent this.
            throw new Error("LeftPanelComponent could not find its container element ('#left-panel') in the DOM.");
        }

        this.eventAggregator = eventAggregator;
        this.detailConfigView = detailConfigView; // This is the manager for K1, K2, etc.

        // --- DOM Element Caching ---
        this.toggleButton = this.panelElement.querySelector(`#${DOM_IDS.LEFT_PANEL_TOGGLE}`);
        this.content = this.panelElement.querySelector('.panel-content');
        this.tabs = this.panelElement.querySelectorAll('.tab-button');
        this.tabContents = this.panelElement.querySelectorAll('.tab-content');
        this.backButton = this.panelElement.querySelector('#back-to-grid-view');

        // --- Child Component Initialization ---
        this.inputHandler = new LeftPanelInputHandler(this.panelElement, this.eventAggregator);

        this._initializeEventListeners();
        console.log("LeftPanelComponent Initialized.");
    }

    _initializeEventListeners() {
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggle());
        }

        if (this.backButton) {
            this.backButton.addEventListener('click', () => {
                this.eventAggregator.publish(EVENTS.USER_NAVIGATED_TO_QUICK_QUOTE_VIEW);
                this.hide();
            });
        }

        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tabFor;
                this.eventAggregator.publish(EVENTS.USER_SWITCHED_TAB, { tabId });
            });
        });
    }

    toggle() {
        this.panelElement.classList.toggle('is-open');
    }

    show() {
        this.panelElement.classList.add('is-open');
    }

    hide() {
        this.panelElement.classList.remove('is-open');
    }

    render(state) {
        const { currentView, activeTab } = state.ui;

        if (currentView === 'DETAIL_CONFIG') {
            this.show();
        } else {
            this.hide();
        }

        this.tabs.forEach(tab => {
            const tabId = tab.dataset.tabFor;
            if (tabId === activeTab) {
                tab.classList.add('is-active');
            } else {
                tab.classList.remove('is-active');
            }
        });

        // Delegate rendering of the tab content to the DetailConfigView manager
        this.detailConfigView.render(state);
    }
}