import React from 'react';

interface ClearProps {
  onClear: () => void;
}

function Clear({ onClear }: ClearProps) {
  return (
    <div className="clear">
      <button onClick={onClear}>Clear Spreadsheet</button>
    </div>
  );
}

export default Clear;
