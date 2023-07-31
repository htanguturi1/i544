import SpreadsheetWs from './ss-ws.js';

import { Result, okResult, errResult, OkResult } from 'cs544-js-utils';

import { Errors, makeElement } from './utils.js';

const [N_ROWS, N_COLS] = [10, 10];

export default async function make(ws: SpreadsheetWs, ssName: string) {
  return await Spreadsheet.make(ws, ssName);
}


class Spreadsheet {

  private readonly ws: SpreadsheetWs;
  private readonly ssName: string;
  private readonly errors: Errors;
  private focusedCellId: string | null;
  private copycellId: string | null
  //TODO: add more instance variables

  constructor(ws: SpreadsheetWs, ssName: string) {
    this.ws = ws; this.ssName = ssName;
    this.errors = new Errors();
    this.makeEmptySS();
    this.addListeners();
    this.focusedCellId = null;
  }

  static async make(ws: SpreadsheetWs, ssName: string) {
    const ss = new Spreadsheet(ws, ssName);
    await ss.load();
    return ss;
  }

  /** add listeners for different events on table elements */
  private addListeners() {
    const clearButton = document.querySelector('#clear');
    if (clearButton) {
      clearButton.addEventListener('click', async () => {
        const response = await this.ws.clear(this.ssName);
        if (response.isOk) {
          const cellElements = document.querySelectorAll('.cell');
          cellElements.forEach((cell) => {
            cell.textContent = '';
            cell.removeAttribute('data-expr');
            cell.removeAttribute('data-value');
            cell.classList.remove('is-copy-source');
          });

        }
      });
    }
    const cellElements = document.querySelectorAll('.cell');
    cellElements.forEach((cell) => {
      cell.addEventListener('focusin', this.focusCell);
      cell.addEventListener('focusout', this.blurCell);
      cell.addEventListener('copy', this.copyCell);
      cell.addEventListener('paste', this.pasteCell);
    });
  }

  private readonly focusCell = (ev: Event) => {
    const target = ev.target as HTMLElement;
    this.focusedCellId = target.id;
    target.textContent = target.dataset.expr || '';
    this.errors.clear()
  };

  private readonly blurCell = async (ev: Event) => {
    const target = ev.target as HTMLElement;
    const storedValue = target.dataset.value
    const storedExpr = target.dataset.expr
    const trimmedContent = target.textContent?.trim();
    if (trimmedContent === '') {
      const response = await this.ws.remove(this.ssName, target.id);
      if (response.isOk) {
        this.evaluationLogic(response.val, target, trimmedContent);
      }
      else {
        target.textContent = target.getAttribute('data-expr') || '';
      }
    }
    else if (trimmedContent === undefined || trimmedContent === null) {
      return;
    }
    else {
      const response = await this.ws.evaluate(this.ssName, target.id, trimmedContent);
      if (response.isOk) {
        this.evaluationLogic(response.val, target, trimmedContent);
      }
      else {
        this.errors.display(response.errors)
        if (storedValue) {
          target.dataset.value = storedValue.toString();
          target.dataset.expr = storedExpr;
          target.textContent = storedValue.toString()
        }
        else {
          target.dataset.value = ''
          target.dataset.expr = ''
          target.textContent = ''
        }
      }
    }
    this.focusedCellId = null;
  };

  /** listener for a copy event on a spreadsheet data cell */
  private readonly copyCell = (ev: Event) => {
    const sourceCell = ev.target as HTMLElement;
    this.copycellId = sourceCell.id;
    sourceCell.classList.add('is-copy-source');
  };

  /** listener for a paste event on a spreadsheet data cell */
  private readonly pasteCell = async (ev: Event) => {
    ev.preventDefault()
    const destinationCell = ev.target as HTMLElement;
    const destinationCellId = destinationCell.id;
    if (this.copycellId) {
      const srcEl = document.getElementById(this.copycellId)
      if (srcEl) {
        srcEl.classList.remove('is-copy-source')
      }
    }
    else return
    const response = await this.ws.copy(this.ssName, destinationCellId, this.copycellId);
    if (response.isOk) {
      const updates = response.val;
      for (const [cellId, value] of Object.entries(updates)) {
        const cellElement = document.getElementById(cellId);
        const destCellExprResponse = await this.ws.query(this.ssName, cellId);
        if (destCellExprResponse.isOk) {
          const destinationCellExpression = destCellExprResponse.val.expr;
          if (cellElement) {
            cellElement.dataset.value = value.toString();
            cellElement.dataset.expr = destinationCellExpression;
            cellElement === destinationCell ? cellElement.textContent = destinationCellExpression : cellElement.textContent = value.toString()
          }
        }

      }

    }
    else {
      // console.error('Error copying content:', response.errors);
      this.errors.display(response.errors)
    }
    this.focusedCellId = null;
  };

  private evaluationLogic(response: Object, target: HTMLElement, trimmedContent: string) {
    const updates = response;
    for (const [cellId, value] of Object.entries(updates)) {
      const cellElement = document.getElementById(cellId);
      if (cellId != this.focusedCellId) {
        if (cellElement) {
          cellElement.dataset.value = value.toString();
          target.dataset.expr = trimmedContent;
          cellElement.textContent = value.toString();

        }
      }
    }
  }

  /** Replace entire spreadsheet with that from the web services.
   *  Specifically, for each active cell set its data-value and 
   *  data-expr attributes to the corresponding values returned
   *  by the web service and set its text content to the cell value.
   */
  /** load initial spreadsheet data into DOM */
  private async load() {
    const resultdata = await (this.ws.dumpWithValues(this.ssName))
    if (resultdata.isOk) {
      const data = resultdata.val;
      for (const [cellId, expr, value] of data) {
        const cellElement = document.getElementById(cellId);
        if (cellElement) {
          cellElement.dataset.expr = expr;
          cellElement.dataset.value = value.toString()
          cellElement.textContent = value.toString();
        }
      }
    }
    else {
      const errors = resultdata.errors;
      console.error('Error loading data:', errors);
    }
  }


  private makeEmptySS() {
    const ssDiv = document.querySelector('#ss')!;
    ssDiv.innerHTML = '';
    const ssTable = makeElement('table');
    const header = makeElement('tr');
    const clearCell = makeElement('td');
    const clear = makeElement('button', { id: 'clear', type: 'button' }, 'Clear');
    clearCell.append(clear);
    header.append(clearCell);
    const A = 'A'.charCodeAt(0);
    for (let i = 0; i < N_COLS; i++) {
      header.append(makeElement('th', {}, String.fromCharCode(A + i)));
    }
    ssTable.append(header);
    for (let i = 0; i < N_ROWS; i++) {
      const row = makeElement('tr');
      row.append(makeElement('th', {}, (i + 1).toString()));
      const a = 'a'.charCodeAt(0);
      for (let j = 0; j < N_COLS; j++) {
        const colId = String.fromCharCode(a + j);
        const id = colId + (i + 1);
        const cell =
          makeElement('td', { id, class: 'cell', contentEditable: 'true' });
        row.append(cell);
      }
      ssTable.append(row);
    }
    ssDiv.append(ssTable);
  }

}



