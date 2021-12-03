const express = require('express')
const cors = require('cors')
const { MongoClient } = require('mongodb');
const ObjectID = require('mongodb').ObjectId;
const { initializeApp } = require('firebase-admin/app');
var admin = require("firebase-admin");
require('dotenv').config();
const app = express();

//firebase admin initailization
var serviceAccount = require('./todo-app-nh-firebase-adminsdk-ehx7n-2dfd97df11.json');
// var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//middleware
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jiiff.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//Verify using JWT
async function verifyToken(req,res,next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const idToken = req.headers.authorization.split(" ")[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            req.decodedUserEmail = decodedUser.email;
        } catch (error) {
            
        }
    }
    next();
}

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
      //check is admin or not
      app.get('/users_admin/:email', async(req,res)=>{
        const email = req.params.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query)
        let isAdmin = false;
        if(user?.role === 'admin'){
          isAdmin = true;
        }
        res.json({'admin': isAdmin});
      })

      //Get All User
      app.get('/users', async(req,res)=>{
          const cursor = usersCollection.find({})
          const users= await cursor.toArray();
          res.json(users)
      })
      //delete single user
      app.delete('/user/:id', async(req,res)=>{
        const id = req.params.id;  
        const result = await usersCollection.deleteOne({_id:ObjectID(id)})
        res.json(result)
      })

      //Get single user
      app.get('/user/:id', async(req,res)=>{
        const id = req.params.id;
        const user = await usersCollection.findOne({_id:ObjectID(id)});
        res.json(user)
      })
      //
    
      //Notes post
      app.post('/notes', async(req,res)=>{
          const data = req.body;
          const user = await usersCollection.findOne({email:data.email})
          const options = { upsert: true };
          if(user?.subscription?.limit>0){
                const filter =   {email:data.email};
                const newlimit = user.subscription.limit-1;
                const sub ={...user.subscription,limit : newlimit}
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
      app.get('/notes/:email', verifyToken, async(req,res)=>{
          
          const email = req.params.email;
          if(req.decodedUserEmail === email){
             
            const query = {email: email};
            const cursor = notesCollection.find(query);
            const notes = await cursor.toArray();
            res.json(notes)
           
          }
          else{
              res.status(401).json({message:'User not authorized'})
          }
          
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

      app.get('/filterNotes',verifyToken, async(req,res)=>{
        const email = req.query.email;
        if(req.decodedUserEmail === email){
            const date = new Date(req.query.date).toLocaleDateString();
            // console.log(email,date);
            const query = {email:email, date:date}
            const cursor = notesCollection.find(query);
            const notes = await cursor.toArray();
            res.json(notes);
        }
        else{
            res.status(401).json({message:'User not authorized'})
        }
        
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

      //add subscription
      app.post('/subscription', async(req,res)=>{
          const data = req.body;
          const result = await subscriptionsCollection.insertOne(data);
          res.json(result);
      })
      //update subscription
      app.put('/subscription/:id',async(req,res)=>{
          const id = req.params.id;
          const pack= req.body;
          filter={_id:ObjectID(id)}
          const options = { upsert: true };
          const updateDoc={
              $set:{
                  package_name: pack.package_name,
                  limit:  parseInt(pack.limit),
                  price:  parseInt(pack.price)
              }
          }

          const result = await subscriptionsCollection.updateOne(filter, updateDoc, options)
          res.json(result);
      })
      //delete subscription
      app.delete('/subscription/:id', async(req,res)=>{
        const id = req.params.id;  
        const result = await subscriptionsCollection.deleteOne({_id:ObjectID(id)})
        res.json(result)
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