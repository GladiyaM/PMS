import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

//import routes
import userRoutes from './routes/user.js';
import prescriptionRoutes from './routes/prescription.js';
import reorderRoutes from './routes/reorder.js';
import drugoutsRoutes from './routes/drugouts.js';


import staffRewardRoutes from './routes/staffReward.js';
// import handledRoutes from './routes/handled.js';
import expiredRoutes from './routes/expired.js';
import abtexpiredRoutes from './routes/expired.js';
import outofstockRoutes from './routes/outofstocks.js';
import abtoutofstocksRoutes from './routes/abtoutofstocks.js';

dotenv.config()

const app = express()

//parse the request body
app.use(express.json())

//global middleware
app.use((req, res, next) => {
    console.log(req.path, req.method)
    next()
})

//routes
app.use('/api/user', userRoutes)

app.use('/api/prescription', prescriptionRoutes)

app.use('/api/reorder', reorderRoutes)

app.use('/api/expired', expiredRoutes)

app.use('/api/abtexpired', abtexpiredRoutes)

app.use('/api/outofstock', outofstockRoutes)

app.use('/api/abtoutofstock', abtoutofstocksRoutes)

app.use('/api/staffReward',staffRewardRoutes)

// app.use('/api/handled', handledRoutes)

app.use('/api/drugouts',drugoutsRoutes)


//connect to the database
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    //listen for requests
    app.listen(process.env.PORT, ()=> {
    console.log(`Connected to db & Listening on ${process.env.PORT}`);
})
})
.catch((err) => console.log(err))

