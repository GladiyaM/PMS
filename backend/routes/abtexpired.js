import express from 'express';
import {getabtExpired } from '../controllers/expiredController.js';


const router = express.Router();

// //Get all reorder
router.get('/', getabtExpired )


export default router;