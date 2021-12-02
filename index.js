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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jiiff.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
      await client.connect();
      const database = client.db("Todo-app");
      const notesCollection = database.collection("notes");
      const subscriptionsCollection = database.collection("subscription");
      const usersCollection = database.collection('users');

      //users
      //create user profile
      app.post('/users', async(req,res)=>{
        const data = req.body;
        const result = await usersCollection.insertOne(data);
        res.json('result')
      })


    //Update User Profile
      app.put('/users/:email', async(req,res)=>{
        const user = req.body;
        const prepEmail = req.params.email;
        console.log(prepEmail,user);
        const filter = {email: prepEmail }
        const options = { upsert: true };
        const updateDoc = {
            $set:{
                displayName: user.name,
                email: user.email,
            } 
        }
        const result = await usersCollection.updateOne(filter,updateDoc,options);
        res.json(result);

      })
      //Delete User
      app.delete('/users/:email', async(req,res)=>{
          const email = req.params.email;
          const result = await usersCollection.deleteOne({email:email})
          res.json(result)
      })
    
      //Notes post
      app.post('/notes', async(req,res)=>{
          const data = req.body;
          const user = await usersCollection.findOne({email:data.email})
          const options = { upsert: true };
          if(user?.subscription?.limit>0){
                const filter =   {email:data.email};
                const newlimit = user.subscription.limit-1;
                const sub ={...user.subscription,limit : newlimit}
                console.log(sub);
                const updateDoc = {
                    $set: {
                        subscription:sub
                    },
                };
                const added = await usersCollection.updateOne(filter, updateDoc, options);
                const result = await notesCollection.insertOne(data);
                res.json(result)
          }
          
      })

      //Get Notes
      app.get('/notes/:email', async(req,res)=>{
          const email = req.params.email;
          const query = {email: email};
          const cursor = notesCollection.find(query);
          const notes = await cursor.toArray();
          res.json(notes)
      })

      //Get Single Note
      app.get('/note/:id', async(req,res)=>{
        const id= req.params.id;
        const query = {_id: ObjectID(id)};
        const note = await notesCollection.findOne(query);
        res.json(note)
      })

      //Delete Note 
      app.delete('/notes/:id',async(req,res)=>{
          const id= req.params.id;
          const userEmail = req.body.email;
          const user = await usersCollection.findOne({email:userEmail})
          const filter =   {email:userEmail};
          const options = { upsert: true };
          const newlimit = user.subscription.limit+1;
          const sub ={...user.subscription,limit : newlimit}
           console.log(sub);
           const updateDoc = {
            $set: {
                subscription:sub
            },
          };
        const added = await usersCollection.updateOne(filter, updateDoc, options);
          const query = {_id: ObjectID(id)};
          const result = await notesCollection.deleteOne(query);
          res.json(result);
      })

      //Update Note

      app.put('/noteupdate/:id', async(req,res)=>{
        const id= req.params.id;
        const data = req.body;
        const filter  = { _id: ObjectID(id) };
        const options = { upsert: true };
        const updateDoc = {
            $set: {
                title: data.title,
                note: data.note,
                date: data.date
            },
          };
        const result = await notesCollection.updateOne(filter, updateDoc, options);

        res.json(result)
      })

      //Filter Note

      app.get('/filterNotes', async(req,res)=>{
        const email = req.query.email;
        const date = new Date(req.query.date).toLocaleDateString();
        console.log(email,date);
        const query = {email:email, date:date}
        const cursor = notesCollection.find(query);
        const notes = await cursor.toArray();
        res.json(notes);
      })


      //Subscription
      
      //get all subscrition
      app.get('/subscriptions',async(req,res)=>{
          const cursor = subscriptionsCollection.find({});
          const subscriptions = await cursor.toArray();
          res.json(subscriptions);
      })
      //get a package
      app.get('/subscriptions/:id', async(req,res)=>{
          const id = req.params.id;
          const package = await subscriptionsCollection.findOne({_id: ObjectID(id)});
          res.json(package);
      })

      //user update package
      app.put('/users_subscription/:email', async(req,res)=>{
        const email = req.params.email;
        let sub = req.body;
        const user = await usersCollection.findOne({email:email})
        if(user?.subscription){
            const preLimit = user.subscription.limit;
            const newLimit = sub.limit+preLimit;
            sub = {...sub, limit:newLimit}
            console.log(sub);
        }
        const filter  = { email: email };
        const options = { upsert: true };
        const updateDoc = {
            $set: {
                subscription:sub
            },
          };
        const result = await usersCollection.updateOne(filter, updateDoc, options);
        res.json(result);

      })

      app.get("/users/:email",async(req,res)=>{
        const email = req.params.email;
        const user = await usersCollection.findOne({email:email})
        res.json(user)
      })


    } finally {
    //   await client.close();
    }
  }
  run().catch(console.dir);


app.get("/",(req,res)=>{
    res.send("Todo app")
})

app.listen(port,()=>{
    console.log("Litsening from port ",port);
})