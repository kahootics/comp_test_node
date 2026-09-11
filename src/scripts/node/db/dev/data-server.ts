import express from 'express';
const app = express();
const port = 3000;

// return entire database
app.get('/db/:type/records', () => {
    
});
// return restricted view
app.get('/db/views/:name', () => { });
// edit a record
app.patch('/db/:type/records', () => { });
// import csv
app.post('/db/:type/import', () => { })