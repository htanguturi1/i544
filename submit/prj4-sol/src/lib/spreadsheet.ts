import SpreadsheetWs from './ss-ws.js';

import { Result, okResult, errResult } from 'cs544-js-utils';

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
    //TODO: initialize added instance variables
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
            cell.textContent = ''; // Clear text content
            cell.removeAttribute('data-expr'); // Remove data-expr attribute
            cell.removeAttribute('data-value'); // Remove data-value attribute
          });
          cellElements.forEach((cell) => {
            cell.classList.remove('is-copy-source');
          });
        } else {
          // Handle the case when there is an error clearing the spreadsheet
          console.error('Error clearing the spreadsheet:', response.errors);
        }
      });
    }
 
     // Handler for focusin event on a .cell element
     const cellElements = document.querySelectorAll('.cell');
     cellElements.forEach((cell) => {
       cell.addEventListener('focusin', this.focusCell);
       cell.addEventListener('focusout', this.blurCell);
       cell.addEventListener('copy', this.copyCell);
       cell.addEventListener('paste', this.pasteCell);
     });
  }

  private readonly focusCell = (ev: Event) => {
    console.log('entered focus');
    const target = ev.target as HTMLElement;
    this.focusedCellId = target.id; // Store the ID of the currently focused cell
    target.textContent = target.dataset.expr || '';
    this.errors.clear()
    
  };

  private readonly blurCell = async (ev: Event) => {
    const target = ev.target as HTMLElement;
    const storedValue= target.dataset.value
    const storedExpr=target.dataset.expr
    console.log('blur caused cell is :'+target.id)
    const trimmedContent = target.textContent?.trim();

    if (trimmedContent === undefined || trimmedContent === null) {
      return;
    }

    else if (trimmedContent === '') 
    {
      const response = await this.ws.remove(this.ssName, target.id);
      if (response.isOk) {
        const updates = response.val;
        for (const [cellId, value] of Object.entries(updates)) {
          const destinationCellExpressionResponse = await this.ws.query(this.ssName, cellId);
          const cellElement = document.getElementById(cellId);
         if(cellElement )
         {
          if(destinationCellExpressionResponse.isOk)
          {
            cellElement.dataset.expr=destinationCellExpressionResponse.val.expr
            cellElement.dataset.value=value.toString()
            cellElement.textContent=value.toString()
          }
        
         }
        }
        target.setAttribute('data-expr','');
        target.setAttribute('data-value','0');
      } 
      else 
      {
        console.error('Error removing cell formula:', response.errors);
        // Restore the content to expression since the removal failed
        target.textContent = target.getAttribute('data-expr') || '';
      }
    } 
    else {
      const response = await this.ws.evaluate(this.ssName, target.id, trimmedContent);
      if (response.isOk) {
        const updates = response.val;
        for (const [cellId, value] of Object.entries(updates)) {
          const cellElement = document.getElementById(cellId);
          if (cellElement) {
            if(this.focusedCellId && cellElement.id !== this.focusedCellId){
              cellElement.dataset.value = value.toString();
              cellElement.textContent = value.toString();
            }
            target.dataset.expr = trimmedContent;
          }
        }
      } else {
        console.error('Error evaluating cell formula:', response.errors);
        this.errors.display(response.errors)
      if(storedValue){
        target.setAttribute('data-value', storedValue.toString());
        target.dataset.expr = storedExpr;
         target.textContent = storedValue.toString()
      }
 
      }
    }
    this.focusedCellId = null;
  };
  
  /** listener for a copy event on a spreadsheet data cell */
  private readonly copyCell = (ev: Event) => {
    console.log('Copy event triggered.');
    const sourceCell = ev.target as HTMLElement;
    this.copycellId = sourceCell.id;
    console.log(this.copycellId);
    sourceCell.classList.add('is-copy-source');
  };

  /** listener for a paste event on a spreadsheet data cell */
  private readonly pasteCell = async (ev: Event) => {
    ev.preventDefault()
    console.log('paste event triggered.');
    const destinationCell = ev.target as HTMLElement;
    const destinationCellId = destinationCell.id;
    
    if (!this.copycellId) return;
    else
    {
      const srcEl = document.getElementById(this.copycellId)
      if(srcEl){
      srcEl.classList.remove('is-copy-source')}
    }
    const response = await this.ws.copy(this.ssName, destinationCellId,this.copycellId );
    if (response.isOk) {
      const updates = response.val;
        for (const [cellId, value] of Object.entries(updates)) {
          const cellElement = document.getElementById(cellId);
          const destinationCellExpressionResponse = await this.ws.query(this.ssName, cellId);
          if (destinationCellExpressionResponse.isOk) {
            const destinationCellExpression = destinationCellExpressionResponse.val.expr;
                if (cellElement) {
                  cellElement.setAttribute('data-value', value.toString());
                  cellElement.dataset.expr= destinationCellExpression;
                  if(cellElement===destinationCell){
                    cellElement.textContent=destinationCellExpression
                  }
                  else{
                    cellElement.textContent=value.toString()
                  }
                }
          }
        }
        
    } else {
      console.error('Error copying content:', response.errors);
    }
    this.focusedCellId = null;
  };

  /** Replace entire spreadsheet with that from the web services.
   *  Specifically, for each active cell set its data-value and 
   *  data-expr attributes to the corresponding values returned
   *  by the web service and set its text content to the cell value.
   */
  /** load initial spreadsheet data into DOM */
  private async load() {
   const resultdata =await (this.ws.dumpWithValues(this.ssName)) 
   console.log(resultdata)
   if (resultdata.isOk) {
    const data = resultdata.val;
    for (const [cellId, expr, value] of data) {
      const cellElement = document.getElementById(cellId);
      if (cellElement) {
        cellElement.dataset.expr = expr;
        cellElement.dataset.value = value.toString()
        cellElement.textContent = value.toString();
        console.log(cellElement)
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
    const clear = makeElement('button', {id: 'clear', type: 'button'}, 'Clear');
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
	  makeElement('td', {id, class: 'cell', contentEditable: 'true'});
	row.append(cell);
      }
      ssTable.append(row);
    }
    ssDiv.append(ssTable);
  }

}



