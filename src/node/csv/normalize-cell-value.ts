
export default function normalizeCellValue(value: string | number | null, newLineReplacer?: string) {
	
	if (value === null || value === 'null' || value === "") return null;
  	if (value === 'TRUE') return true;
  	if (value === 'FALSE') return false;
  	if (!isNaN(Number(value))) return Number(value);
	if (typeof value === 'string') return (newLineReplacer ? value.replaceAll(newLineReplacer, '\n').trim() : value.trim());
  	return value;

}
