import React, { useEffect, useState } from 'react';
import './style.css';
import SpreadsheetWs from './ss-ws';

const N_COLS = 10;
const N_ROWS = 10;

const SpreadsheetApp = () => {
  const [loadedData, setLoadedData] = useState<[string, string, number][]>([]);
  const [cellData, setCellData] = useState<{ [key: string]: { value: string, expression: string } }>({});
  const [focusedCell, setFocusedCell] = useState<string>('');


  const handleLoadSpreadsheet = async (event: React.FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      const wsUrlInput = document.querySelector('#ws-url') as HTMLInputElement;
      const ssNameInput = document.querySelector('#ss-name') as HTMLInputElement;
      const wsUrl = wsUrlInput.value.trim();
      const ssName = ssNameInput.value.trim();

      if (wsUrl.length === 0 || ssName.length === 0) {
        throw new Error('Both the Web Services URL and Spreadsheet Name must be specified');
      }

      const ws = SpreadsheetWs.make(wsUrl);
      const result = await ws.dumpWithValues(ssName);

      if (result.isOk) {
        const spreadsheetData = result.val;
        console.log(spreadsheetData);

        const loadedCellData: { [key: string]: { value: string, expression: string } } = {};
        for (const [cellId, expr, value] of spreadsheetData) {
          loadedCellData[cellId] = { value: value.toString(), expression: expr };
        }

        setLoadedData(spreadsheetData);
        setCellData(loadedCellData);
      } else {
        console.error(result.errors);
      }
    } catch (error) {
      console.error(error);
    }
  };
  const handleClear = async () => {
    try {
      const wsUrlInput = document.querySelector('#ws-url') as HTMLInputElement;
      const ssNameInput = document.querySelector('#ss-name') as HTMLInputElement;
      const wsUrl = wsUrlInput.value.trim();
      const ssName = ssNameInput.value.trim();

      if (wsUrl.length === 0 || ssName.length === 0) {
        throw new Error('Both the Web Services URL and Spreadsheet Name must be specified');
      }

      const ws = SpreadsheetWs.make(wsUrl);
      const result = await ws.clear(ssName);

      if (result.isOk) {
        console.log('Spreadsheet cleared successfully');
        // Clear loaded data
        setLoadedData([]);
        const editableCells = document.querySelectorAll('.cell[contentEditable="true"]');
        editableCells.forEach(cell => cell.textContent = '');
      } else {
        console.error(result.errors);
      }
    } catch (error) {
      console.error(error);
    }
  };


  const handleCellFocus = (event: React.FocusEvent<HTMLTableCellElement>) => {
    const target = event.target;
    const cellId = target.id;
    setFocusedCell(cellId);
  };
  
  const handleCellBlur = async (event: React.FocusEvent<HTMLTableCellElement>) => {
    const target = event.target;
    const cellId = target.id;
    const expr = target.textContent!.trim();
    
    try {
      const wsUrlInput = document.querySelector('#ws-url') as HTMLInputElement;
      const ssNameInput = document.querySelector('#ss-name') as HTMLInputElement;
      const wsUrl = wsUrlInput.value.trim();
      const ssName = ssNameInput.value.trim();
  
      if (wsUrl.length === 0 || ssName.length === 0) {
        throw new Error('Both the Web Services URL and Spreadsheet Name must be specified');
      }
  
      const ws = SpreadsheetWs.make(wsUrl);
  
      const updatesResult =
        expr.length > 0
          ? await ws.evaluate(ssName, cellId, expr)
          : await ws.remove(ssName, cellId);
  
      if (updatesResult.isOk) {
        console.log(updatesResult)
        console.log('Cell updated successfully');
        const updatedValue = updatesResult.val[cellId].toString();
        const updatedExpression = expr;
        setCellData((prevData) => ({
          ...prevData,
          [cellId]: {
            value: updatedValue,
            expression: updatedExpression,
          },
        }));
        Object.entries(updatesResult.val).forEach(([dependentCellId, dependentCellValue]) => {
          if (dependentCellId !== cellId) {
            setCellData((prevData) => ({
              ...prevData,
              [dependentCellId]: {
                value: dependentCellValue.toString(),
                expression: prevData[dependentCellId]?.expression || '',
              },
            }));
          }
        });
      } else {
        console.error(updatesResult.errors);
      }
    } catch (error) {
      console.error(error);

    }
    target.textContent = cellData[cellId]?.value || '';
  };
  return (
    <div>
      <form className="form" id="ss-form" onSubmit={handleLoadSpreadsheet}>
        <label htmlFor="ws-url">Web Services URL</label>
        <input
          type="text"
          id="ws-url"
          name="ws-url"
          defaultValue="https://zdu.binghamton.edu:2345"
        />
        <label htmlFor="ss-name">Spreadsheet Name</label>
        <input type="text" id="ss-name" name="ss-name" />
        <button type="submit" style={{marginLeft:10}}>Load Spreadsheet</button>
      </form>
      <ul className="error" id="errors"></ul>
      <div id="ss">
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" onClick={handleClear} style={{ backgroundColor: 'red', color: 'black' }}>Clear</button>
              </th>
              {Array.from({ length: N_COLS }, (_, colIndex) => (
                <th key={colIndex}>{String.fromCharCode('A'.charCodeAt(0) + colIndex)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: N_ROWS }, (_, rowIndex) => (
              <tr key={rowIndex + 1}>
                <th>{rowIndex + 1}</th>
                {Array.from({ length: N_COLS }, (_, colIndex) => {
                    const cellId = String.fromCharCode('a'.charCodeAt(0) + colIndex) + (rowIndex + 1);
                    const loadedCellData = loadedData.find(data => data[0] === cellId);
                    const cellValue = cellData[cellId]?.value || (loadedCellData ? loadedCellData[2].toString() : '');
                    const cellExpression = focusedCell === cellId ? cellData[cellId]?.expression : '';
                  return (
                    <td
                      key={cellId}
                      id={cellId}
                      className="cell"
                      contentEditable='true'
                      onFocus={handleCellFocus}
                      onBlur={handleCellBlur}
                    >
                     {focusedCell === cellId ? cellExpression : cellValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpreadsheetApp;
