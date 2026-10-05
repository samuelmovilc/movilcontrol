const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:\\Users\\SAMUEL CARIBEP\\Downloads\\PLANTILLA INVENTARIO (5).xlsx');
const sheet_name_list = workbook.SheetNames;
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
console.log(JSON.stringify(data.slice(0, 5), null, 2));
