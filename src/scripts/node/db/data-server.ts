import express from 'express';
const app = express();
const port = 3000;

// return entire database
app.get('/api/db/:type/records', () => {

});
// return restricted view
app.get('/api/views/:name', () => { });
// edit a record
app.patch('/api/db/:type/records', () => { });
// import csv
app.post('/api/db/:type/import', () => { })