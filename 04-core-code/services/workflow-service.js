// File: 04-core-code/services/workflow-service.js

import { initialState } from '../config/initial-state.js';
import { EVENTS, DOM_IDS } from '../config/constants.js';
import * as uiActions from '../actions/ui-actions.js';
import * as quoteActions from '../actions/quote-actions.js';
import { paths } from '../config/paths.js';

/**
 * @fileoverview A dedicated service for coordinating complex, multi-step user workflows.
 */
export class WorkflowService {
    constructor({ eventAggregator, stateService, fileService, calculationService, productFactory, detailConfigView, configManager }) {
        this.eventAggregator = eventAggregator;
        this.stateService = stateService;
        this.fileService = fileService;
        this.calculationService = calculationService;
        this.productFactory = productFactory;
        this.detailConfigView = detailConfigView;
        this.configManager = configManager;
        this.quotePreviewComponent = null;

        this.f2InputSequence = [
            'f2-b10-wifi-qty', 'f2-b13-delivery-qty', 'f2-b14-install-qty',
            'f2-b15-removal-qty', 'f2-b17-mul-times', 'f2-b18-discount'
        ];
        console.log("WorkflowService Initialized.");
    }

    setQuotePreviewComponent(component) {
        this.quotePreviewComponent = component;
    }

    async handlePrintableQuoteRequest() {
        try {
            const [quoteTemplate, appendixTemplate, ...styles] = await this._loadPreviewAssets();

            const { quoteData, ui } = this.stateService.getState();
            const f3Data = this._getF3OverrideData();
            const summaryData = this.calculationService.calculateF2Summary(quoteData, ui);

            // Prepare all data chunks
            const templateData = this._prepareTemplateData(quoteData, ui, f3Data, summaryData);

            // First, populate the appendix template with its specific content
            const appendixHtml = this._populateTemplate(appendixTemplate, templateData);

            // Then, add the fully populated appendix HTML to the main template's data
            templateData.appendixHtml = appendixHtml;

            // Now, populate the main quote template
            let finalHtml = this._populateTemplate(quoteTemplate, templateData);

            // Inject styles and finalize
            const styleString = `<style>${styles.join('\n')}</style>`;
            finalHtml = finalHtml.replace('', styleString);

            this.eventAggregator.publish(EVENTS.SHOW_QUOTE_PREVIEW, finalHtml);
        } catch (error) {
            console.error("Error generating printable quote:", error);
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                message: "Failed to generate quote preview. See console for details.",
                type: 'error',
            });
        }
    }

    async _loadPreviewAssets() {
        const fetchText = (url) => fetch(url).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
            return res.text();
        });

        // Load all required CSS files for injection
        return Promise.all([
            fetchText(paths.partials.quoteTemplate),
            fetchText(paths.partials.detailedItemList),
            fetchText('./style.css'),
        ]);
    }

    _getF3OverrideData() {
        const getValue = (id) => document.getElementById(id)?.value || '';
        return {
            quoteId: getValue('f3-quote-id'),
            issueDate: getValue('f3-issue-date'),
            dueDate: getValue('f3-due-date'),
            customerName: getValue('f3-customer-name'),
            customerAddress: getValue('f3-customer-address'),
            customerPhone: getValue('f3-customer-phone'),
            customerEmail: getValue('f3-customer-email'),
            finalOfferPrice: getValue('f3-final-offer-price'),
            termsConditions: getValue('f3-terms-conditions'),
        };
    }

    _formatDate(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    _prepareTemplateData(quoteData, ui, f3Data, summaryData) {
        const rollerBlindsHtml = this._createDetailedItemsTable(quoteData, summaryData);
        const motorisedAccessoriesHtml = this._createMotorisedAccessoriesTable(ui);

        return {
            quoteId: f3Data.quoteId,
            issueDate: this._formatDate(f3Data.issueDate),
            dueDate: this._formatDate(f3Data.dueDate),
            customerInfoHtml: this._formatCustomerInfo(f3Data),
            summaryItemsTableBody: this._createSummaryItemsTable(quoteData, ui, summaryData),
            summaryTotalsTable: this._createSummaryTotalsTable(summaryData),
            termsAndConditions: f3Data.termsConditions.replace(/\n/g, '<br>'),
            // [FIX] Combine both tables into a single placeholder for the appendix template
            rollerBlindsTable: rollerBlindsHtml + motorisedAccessoriesHtml,
        };
    }

    _formatCustomerInfo(f3Data) {
        let html = `<strong>${f3Data.customerName || 'Valued Customer'}</strong><br>`;
        if (f3Data.customerAddress) html += `${f3Data.customerAddress.replace(/\n/g, '<br>')}<br>`;
        if (f3Data.customerPhone) html += `Phone: ${f3Data.customerPhone}<br>`;
        if (f3Data.customerEmail) html += `Email: ${f3Data.customerEmail}`;
        return html;
    }

    _createSummaryItemsTable(quoteData, ui, summaryData) {
        const toFixed = (num) => (num || 0).toFixed(2);
        let html = '';
        let itemNumber = 1;

        const items = quoteData.products[quoteData.currentProduct]?.items || [];
        const totalQty = items.length;

        html += `
            <tr>
                <td data-label="#">${itemNumber++}</td>
                <td data-label="Description">
                    <div class="description">Roller Blinds</div>
                    <div class="details">See attached list for details.</div>
                </td>
                <td data-label="QTY" class="align-right">${totalQty}</td>
                <td data-label="Price" class="align-right original-price">$${toFixed(summaryData.firstRbPrice)}</td>
                <td data-label="Discounted Price" class="align-right discounted-price">$${toFixed(summaryData.disRbPrice)}</td>
            </tr>`;

        if (summaryData.acceSum > 0) {
            html += `
                <tr>
                    <td data-label="#">${itemNumber++}</td>
                    <td data-label="Description">
                        <div class="description">Installation Accessories</div>
                        <div class="details">Dual Brackets, HD Winders, etc.</div>
                    </td>
                    <td data-label="QTY" class="align-right">N/A</td>
                    <td data-label="Price" class="align-right">$${toFixed(summaryData.acceSum)}</td>
                    <td data-label="Discounted Price" class="align-right discounted-price">$${toFixed(summaryData.acceSum)}</td>
                </tr>`;
        }

        if (summaryData.eAcceSum > 0) {
            html += `
                <tr>
                    <td data-label="#">${itemNumber++}</td>
                    <td data-label="Description">
                        <div class="description">Motorised Sets & Accessories</div>
                        <div class="details">Motors, Remotes, Chargers, etc.</div>
                    </td>
                    <td data-label="QTY" class="align-right">N/A</td>
                    <td data-label="Price" class="align-right">$${toFixed(summaryData.eAcceSum)}</td>
                    <td data-label="Discounted Price" class="align-right discounted-price">$${toFixed(summaryData.eAcceSum)}</td>
                </tr>`;
        }

        const createFeeRow = (label, qty, fee, isExcluded) => {
            const priceHtml = isExcluded ? `<del>$${toFixed(fee)}</del>` : `$${toFixed(fee)}`;
            const discountedPrice = isExcluded ? 0 : fee;
            return `
                <tr>
                    <td data-label="#">${itemNumber++}</td>
                    <td data-label="Description"><div class="description">${label}</div></td>
                    <td data-label="QTY" class="align-right">${qty}</td>
                    <td data-label="Price" class="align-right">${priceHtml}</td>
                    <td data-label="Discounted Price" class="align-right discounted-price">$${toFixed(discountedPrice)}</td>
                </tr>`;
        };

        if (summaryData.deliveryFee > 0) {
            html += createFeeRow('Delivery', 1, summaryData.deliveryFee, ui.f2.deliveryFeeExcluded);
        }
        if (summaryData.installFee > 0) {
            html += createFeeRow('Installation', totalQty, summaryData.installFee, ui.f2.installFeeExcluded);
        }
        if (summaryData.removalFee > 0) {
            html += createFeeRow('Old Blinds Removal', ui.f2.removalQty || 'N/A', summaryData.removalFee, ui.f2.removalFeeExcluded);
        }

        return html;
    }

    _createSummaryTotalsTable(summaryData) {
        const toFixed = (num) => (num || 0).toFixed(2);
        return `
            <div class="summary-details">
                <table>
                    <tbody>
                        <tr><td class="summary-label">Subtotal</td><td class="summary-value">$${toFixed(summaryData.subTotal)}</td></tr>
                        <tr><td class="summary-label">GST (10%)</td><td class="summary-value">$${toFixed(summaryData.gst)}</td></tr>
                        <tr class="grand-total"><td class="summary-label">Total</td><td class="summary-value">$${toFixed(summaryData.finalTotal)}</td></tr>
                        <tr><td class="summary-label">Deposit (50%)</td><td class="summary-value">$${toFixed(summaryData.deposit)}</td></tr>
                        <tr><td class="summary-label"><strong>Balance</strong></td><td class="summary-value"><strong>$${toFixed(summaryData.balance)}</strong></td></tr>
                        <tr><td class="summary-label">You Saved</td><td class="summary-value savings-value">$${toFixed(summaryData.savings)}</td></tr>
                    </tbody>
                </table>
            </div>`;
    }

    _createDetailedItemsTable(quoteData, summaryData) {
        const toFixed = (num) => (num || 0).toFixed(2);
        const items = quoteData.products[quoteData.currentProduct]?.items || [];
        const mulTimes = summaryData.mulTimes || 1;
        let subtotal = 0;

        let rowsHtml = items.map((item, index) => {
            let fabricClass = '';
            if ((item.type || '').startsWith('B')) {
                fabricClass = 'bg-blockout';
            } else if (item.type === 'SN') {
                fabricClass = 'bg-screen';
            }
            if ((item.fabric || '').toLowerCase().includes('light-filter')) {
                fabricClass = 'bg-light-filter';
            }

            const multipliedPrice = (item.linePrice || 0) * mulTimes;
            subtotal += multipliedPrice;

            return `
                <tr>
                    <td class="text-center">${index + 1}</td>
                    <td class="${fabricClass}">${item.fabric || ''}</td>
                    <td class="${fabricClass}">${item.color || ''}</td>
                    <td>${item.location || ''}</td>
                    <td class="text-center">${item.winder === 'HD' ? '✔' : ''}</td>
                    <td class="text-center">${item.dual === 'D' ? '✔' : ''}</td>
                    <td class="text-center">${item.motor ? '✔' : ''}</td>
                    <td class="text-right">$${toFixed(multipliedPrice)}</td>
                </tr>`;
        }).join('');

        return `
            <div class="table-scroll-wrapper">
                <table class="detailed-list-table">
                    <thead>
                        <tr><th colspan="8" class="text-center table-title">Roller Blinds</th></tr>
                        <tr>
                            <th class="text-center">NO</th><th>Name</th><th>Color</th><th>Location</th>
                            <th class="text-center">HD</th><th class="text-center">Dual</th>
                            <th class="text-center">Motor</th><th class="text-right">Price</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" class="text-right"><strong>Sub total</strong></td>
                            <td class="text-right">$${toFixed(subtotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    _createMotorisedAccessoriesTable(ui) {
        if (!ui.f1 || ui.f1.motor_qty === 0) return '';
        const toFixed = (num) => (num || 0).toFixed(2);
        const f1 = ui.f1;

        let total = 0;
        const rows = [
            { label: 'Motor', detail: `(${f1.motor_qty})`, qty: f1.motor_qty, price: f1.motor_price },
            { label: 'Remote', detail: `1 CH (${f1.remote_1ch_qty})`, qty: f1.remote_1ch_qty, price: f1.remote_1ch_price },
            { label: 'Remote', detail: `16 CH (${f1.remote_16ch_qty})`, qty: f1.remote_16ch_qty, price: f1.remote_16ch_price },
            { label: 'Charger', detail: `(${f1.charger_qty})`, qty: f1.charger_qty, price: f1.charger_price },
            { label: '3M Cord', detail: `(${f1.cord_3m_qty})`, qty: f1.cord_3m_qty, price: f1.cord_3m_price }
        ].filter(item => item.qty > 0);

        if (rows.length === 0) return '';

        let rowsHtml = rows.map(item => {
            const itemTotal = item.qty * item.price;
            total += itemTotal;
            return `
                <tr>
                    <td>${item.label}</td>
                    <td class="text-center">${item.detail}</td>
                    <td class="text-right">$${toFixed(itemTotal)}</td>
                </tr>`;
        }).join('');

        return `
            <div class="table-scroll-wrapper">
                <table class="detailed-list-table">
                    <thead>
                        <tr><th colspan="3" class="text-center table-title">Motorised Accessories</th></tr>
                        <tr><th>Item</th><th class="text-center">Details / QTY</th><th class="text-right">Total Price</th></tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="2" class="text-right"><strong>Total</strong></td>
                            <td class="text-right">$${toFixed(total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    _populateTemplate(template, data) {
        return template.replace(/\{\{\{?(\w+)}}}?/g, (match, key) => {
            // Use hasOwnProperty to prevent accidentally accessing inherited properties
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match;
        });
    }


    handleRemoteDistribution() {
        // ... (existing code remains unchanged)
    }

    handleDualDistribution() {
        // ... (existing code remains unchanged)
    }

    handleF1TabActivation() {
        const { quoteData } = this.stateService.getState();
        const productStrategy = this.productFactory.getProductStrategy(quoteData.currentProduct);
        const { updatedQuoteData } = this.calculationService.calculateAndSum(quoteData, productStrategy);

        this.stateService.dispatch(quoteActions.setQuoteData(updatedQuoteData));
    }

    handleF2TabActivation() {
        // ... (existing code remains unchanged)
    }

    handleNavigationToDetailView() {
        // ... (existing code remains unchanged)
    }

    handleNavigationToQuickQuoteView() {
        // ... (existing code remains unchanged)
    }

    handleTabSwitch({ tabId }) {
        this.detailConfigView.activateTab(tabId);
    }

    handleUserRequestedLoad() {
        // ... (existing code remains unchanged)
    }

    handleLoadDirectly() {
        this.eventAggregator.publish(EVENTS.TRIGGER_FILE_LOAD);
    }

    handleFileLoad({ fileName, content }) {
        // ... (existing code remains unchanged)
    }

    handleF1DiscountChange({ percentage }) {
        this.stateService.dispatch(uiActions.setF1DiscountPercentage(percentage));
    }

    handleToggleFeeExclusion({ feeType }) {
        this.stateService.dispatch(uiActions.toggleF2FeeExclusion(feeType));
        this._calculateF2Summary();
    }

    handleF2ValueChange({ id, value }) {
        // ... (existing code remains unchanged)
    }

    focusNextF2Input(currentId) {
        // ... (existing code remains unchanged)
    }

    _calculateF2Summary() {
        const { quoteData, ui } = this.stateService.getState();
        const summaryValues = this.calculationService.calculateF2Summary(quoteData, ui);

        for (const key in summaryValues) {
            this.stateService.dispatch(uiActions.setF2Value(key, summaryValues[key]));
        }
    }
}