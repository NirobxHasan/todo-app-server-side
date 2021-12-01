const express = require('express')
const cors = require('cors')
const { MongoClient } = require('mongodb');
const ObjectID = require('mongodb').ObjectId;
require('dotenv').config();

const app = express();

//middleware
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;


app.get("/",(req,res)=>{
    res.send("Todo app")
})

app.listen(port,()=>{
    console.log("Litsening from port ",port);
})