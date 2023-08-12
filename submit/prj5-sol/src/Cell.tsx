import React, { useState } from 'react';

interface CellProps {
  cellId: string; // Replace 'string' with the appropriate type for your cell IDs
  value: string; // Replace 'string' with the appropriate type for cell values
  onBlur: (cellId: string, value: string) => void;
  onCopy: (cellId: string) => void;
  onPaste: (cellId: string) => void;
}

function Cell({ cellId, value, onBlur, onCopy, onPaste }: CellProps) {
  const [cellValue, setCellValue] = useState(value);

  const handleBlur = () => {
    setCellValue(cellValue);
    onBlur(cellId, cellValue);
  };

  const handleCopy = () => {
    onCopy(cellId);
  };

  const handlePaste = () => {
    onPaste(cellId);
  };

  return (
    <div className="cell">
      <input
        type="text"
        value={cellValue}
        onChange={(e) => setCellValue(e.target.value)}
        onBlur={handleBlur}
        onCopy={handleCopy}
        onPaste={handlePaste}
      />
    </div>
  );
}

export default Cell;
