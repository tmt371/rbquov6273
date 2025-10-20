// File: 04-core-code/services/workflow-service.js

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';

/**
 * @fileoverview A dedicated service for coordinating complex, multi-step user workflows.
 * This service takes complex procedural logic out of the AppController.
 */
export class WorkflowService {
    constructor({ eventAggregator, stateService, fileService, calculationService, productFactory, detailConfigView }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;

        this.f2InputSequence = [
            'f2-b10-wifi-qty', 'f2-b13-delivery-qty', 'f2-b14-install-qty',
            'f2-b15-removal-qty', 'f2-b17-mul-times', 'f2-b18-discount'
        ];
        console.log("WorkflowService Initialized.");
    }

    handleRemoteDistribution() {
        const { ui } = this.stateService.getState();
        const totalRemoteCount = ui.driveRemoteCount || 0;

        const initial1ch = ui.f1.remote_1ch_qty;
        const initial16ch = (ui.f1.remote_16ch_qty === null) ? totalRemoteCount - initial1ch : ui.f1.remote_16ch_qty;

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total remotes: ${totalRemoteCount}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: '1-Ch Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_1CH, value: initial1ch },
                    { type: 'text', text: '16-Ch Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_16CH, value: initial16ch }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            const qty1ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_1CH).value, 10);
                            const qty16ch = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_16CH).value, 10);

                            if (isNaN(qty1ch) || isNaN(qty16ch) || qty1ch < 0 || qty16ch < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }

                            if (qty1ch + qty16ch !== totalRemoteCount) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Total must equal ${totalRemoteCount}. Current total: ${qty1ch + qty16ch}.`,
                                    type: 'error'
                                });
                                return false;
                            }

                            this.stateService.dispatch(uiActions.setF1RemoteDistribution(qty1ch, qty16ch));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 2, callback: () => { } }
                ]
            ],
            onOpen: () => {
                const input1ch = document.getElementById(DOM_IDS.DIALOG_INPUT_1CH);
                const input16ch = document.getElementById(DOM_IDS.DIALOG_INPUT_16CH);

                input1ch.addEventListener('input', () => {
                    const qty1ch = parseInt(input1ch.value, 10);
                    if (!isNaN(qty1ch) && qty1ch >= 0 && qty1ch <= totalRemoteCount) {
                        input16ch.value = totalRemoteCount - qty1ch;
                    }
                });

                input16ch.addEventListener('input', () => {
                    const qty16ch = parseInt(input16ch.value, 10);
                    if (!isNaN(qty16ch) && qty16ch >= 0 && qty16ch <= totalRemoteCount) {
                        input1ch.value = totalRemoteCount - qty16ch;
                    }
                });

                setTimeout(() => {
                    input1ch.focus();
                    input1ch.select();
                }, 0);
            },
            closeOnOverlayClick: false
        });
    }

    handleDualDistribution() {
        const { quoteData, ui } = this.stateService.getState();
        const items = quoteData.products[quoteData.currentProduct].items;
        const totalDualPairs = Math.floor(items.filter(item => item.dual === 'D').length / 2);

        const initialCombo = (ui.f1.dual_combo_qty === null) ? totalDualPairs : ui.f1.dual_combo_qty;
        const initialSlim = (ui.f1.dual_slim_qty === null) ? 0 : ui.f1.dual_slim_qty;

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Total Dual pairs: ${totalDualPairs}. Please distribute them.`,
            layout: [
                [
                    { type: 'text', text: 'Combo Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_COMBO, value: initialCombo },
                    { type: 'text', text: 'Slim Qty:', className: 'dialog-label' },
                    { type: 'input', id: DOM_IDS.DIALOG_INPUT_SLIM, value: initialSlim }
                ],
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            const qtyCombo = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_COMBO).value, 10);
                            const qtySlim = parseInt(document.getElementById(DOM_IDS.DIALOG_INPUT_SLIM).value, 10);

                            if (isNaN(qtyCombo) || isNaN(qtySlim) || qtyCombo < 0 || qtySlim < 0) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Quantities must be positive numbers.', type: 'error' });
                                return false;
                            }

                            if (qtyCombo + qtySlim !== totalDualPairs) {
                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                                    message: `Total must equal ${totalDualPairs}. Current total: ${qtyCombo + qtySlim}.`,
                                    type: 'error'
                                });
                                return false;
                            }

                            this.stateService.dispatch(uiActions.setF1DualDistribution(qtyCombo, qtySlim));
                            return true;
                        }
                    },
                    { type: 'button', text: 'Cancel', className: 'secondary', colspan: 2, callback: () => { } }
                ]
            ],
            onOpen: () => {
                const inputCombo = document.getElementById(DOM_IDS.DIALOG_INPUT_COMBO);
                const inputSlim = document.getElementById(DOM_IDS.DIALOG_INPUT_SLIM);

                inputSlim.addEventListener('input', () => {
                    const qtySlim = parseInt(inputSlim.value, 10);
                    if (!isNaN(qtySlim) && qtySlim >= 0 && qtySlim <= totalDualPairs) {
                        inputCombo.value = totalDualPairs - qtySlim;
                    }
                });

                inputCombo.addEventListener('input', () => {
                    const qtyCombo = parseInt(inputCombo.value, 10);
                    if (!isNaN(qtyCombo) && qtyCombo >= 0 && qtyCombo <= totalDualPairs) {
                        inputSlim.value = totalDualPairs - qtyCombo;
                    }
                });

                setTimeout(() => {
                    inputSlim.focus();
                    inputSlim.select();
                }, 0);
            },
            closeOnOverlayClick: false
        });
    }

    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
    }

    handleF2TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));

        this.detailConfigView.driveAccessoriesView.recalculateAllDriveAccessoryPrices();
        this.detailConfigView.dualChainView._calculateAndStoreDualPrice();

        this._calculateF2Summary();

        this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: 'f2-b10-wifi-qty' });
    }

    handleNavigationToDetailView() {
        const { ui } = this.stateService.getState();
        if (ui.currentView === 'QUICK_QUOTE') {
            this.stateService.dispatch(uiActions.setCurrentView('DETAIL_CONFIG'));
            this.detailConfigView.activateTab('k1-tab');
        } else {
            this.stateService.dispatch(uiActions.setCurrentView('QUICK_QUOTE'));
            this.stateService.dispatch(uiActions.setVisibleColumns(initialState.ui.visibleColumns));
        }
    }

    handleNavigationToQuickQuoteView() {
        this.stateService.dispatch(uiActions.setCurrentView('QUICK_QUOTE'));
        this.stateService.dispatch(uiActions.setVisibleColumns(initialState.ui.visibleColumns));
    }

    handleTabSwitch({ tabId }) {
        this.detailConfigView.activateTab(tabId);
    }

    handleUserRequestedLoad() {
        const { quoteData } = this.stateService.getState();
        const productKey = quoteData.currentProduct;
        const items = quoteData.products[productKey] ? quoteData.products[productKey].items : [];
        const hasData = items.length > 1 || (items.length === 1 && (items[0].width || items[0].height));

        if (hasData) {
            this.eventAggregator.publish(EVENTS.SHOW_LOAD_CONFIRMATION_DIALOG);
        } else {
            this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
        }
    }

    handleLoadDirectly() {
        this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
    }

    handleFileLoad({ fileName, content }) {
        const result = this.fileService.parseFileContent(fileName, content);
        if (result.success) {
            this.stateService.dispatch(quoteActions.setQuoteData(result.data));
            this.stateService.dispatch(uiActions.resetUi());
            this.stateService.dispatch(uiActions.setSumOutdated(true));
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message });
        } else {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: result.message, type: 'error' });
        }
    }

    handleF1DiscountChange({ percentage }) {
        this.stateService.dispatch(uiActions.setF1DiscountPercentage(percentage));
    }

    handleToggleFeeExclusion({ feeType }) {
        this.stateService.dispatch(uiActions.toggleF2FeeExclusion(feeType));
        this._calculateF2Summary();
    }

    handleF2ValueChange({ id, value }) {
        const numericValue = value === '' ? null : parseFloat(value);
        let keyToUpdate = null;

        switch (id) {
            case 'f2-b10-wifi-qty': keyToUpdate = 'wifiQty'; break;
            case 'f2-b13-delivery-qty': keyToUpdate = 'deliveryQty'; break;
            case 'f2-b14-install-qty': keyToUpdate = 'installQty'; break;
            case 'f2-b15-removal-qty': keyToUpdate = 'removalQty'; break;
            case 'f2-b17-mul-times': keyToUpdate = 'mulTimes'; break;
            case 'f2-b18-discount': keyToUpdate = 'discount'; break;
        }

        if (keyToUpdate) {
            this.stateService.dispatch(uiActions.setF2Value(keyToUpdate, numericValue));
            this._calculateF2Summary();
        }
    }

    focusNextF2Input(currentId) {
        const currentIndex = this.f2InputSequence.indexOf(currentId);
        if (currentIndex > -1 && currentIndex < this.f2InputSequence.length - 1) {
            const nextElementId = this.f2InputSequence[currentIndex + 1];
            this.eventAggregator.publish(EVENTS.FOCUS_ELEMENT, { elementId: nextElementId });
        } else {
            // If it's the last element, blur it.
            const currentElement = document.getElementById(currentId);
            currentElement?.blur();
        }
    }

    _calculateF2Summary() {
        const { quoteData, ui } = this.stateService.getState();
        const summaryValues = this.calculationService.calculateF2Summary(quoteData, ui);

        for (const key in summaryValues) {
            this.stateService.dispatch(uiActions.setF2Value(key, summaryValues[key]));
        }
    }
}