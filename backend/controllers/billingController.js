import Drug from '../models/drugModel.js';
import MedicineName from '../models/medicineModel.js';
import Bill from '../models/billingModel.js';
import User from '../models/userModel.js'; 
import mongoose from 'mongoose';
const{Types} = mongoose;



// Function to calculate item total for each medicine
const calculateItemTotal = (medicine) => {
    const itemTotal = parseFloat((medicine.purchaseQuantity * medicine.price).toFixed(2));
    return itemTotal.toFixed(2); // Ensure two decimal places are always displayed
};

// Function to calculate subtotal for the bill
const calculateSubTotal = (medicines) => {
    const subTotal = parseFloat(medicines.reduce((total, medicine) => {
        return total + parseFloat(calculateItemTotal(medicine));
    }, 0).toFixed(2));
    return subTotal.toFixed(2); // Ensure two decimal places are always displayed
};

// Function to retrieve discount for user based on access number
const retrieveDiscountForUser = async (customerID, invoiceDate) => {
    try {
        // Retrieve the user based on the customerID
        const user = await User.findOne({ contact: customerID });

        if (user && user.coupons.length > 0) {
            // Sort coupons based on the access number and expiry date
            const sortedCoupons = user.coupons.sort((a, b) => {
                // First, compare by access number
                if (a.accessNumber !== b.accessNumber) {
                    return a.accessNumber - b.accessNumber;
                }
                // If access numbers are equal, compare by expiry date
                return new Date(a.expire) - new Date(b.expire);
            });

            // Find the first available coupon that is not used and not expired
            const validCoupon = sortedCoupons.find(coupon => {

            if (new Date(coupon.expire).getTime() === new Date(invoiceDate).getTime()) {
                return false; // Exclude if expiration date is the same as invoice date
            }
            return !coupon.used && new Date(coupon.expire) >= new Date();
            });
            // If a valid coupon is found, return its discount
            if (validCoupon) {
                return validCoupon.discount;
            }
        }

        // Return 0 if no valid discount found
        return 0;
    } catch (error) {
        // Handle errors
        console.error('Error retrieving discount for user:', error);
        throw new Error('Failed to retrieve discount for user');
    }
};


// Function to calculate the discount amount based on the subtotal and discount percentage
const calculateDiscountAmount = (subTotal, discount) => {
    // Parse the discount percent as a number, defaulting to 0 if it's null
    const parsedDiscount = discount !== null ? parseFloat(discount) : 0;

    //Check if discount is a valid number
    if(isNaN(parsedDiscount)){
        throw new Error('Invalid discount');
    }

    // Calculate the discount amount
    const discountAmount = subTotal * (parsedDiscount/ 100);
    return discountAmount.toFixed(2); // Ensure two decimal places are always displayed 
};


//Function to calculate grand total for the bill
const calculateGrandTotal = (subTotal, discount) => {
    // Parse the discount as a number, or default to 0 if it's null
    const parsedDiscount = discount !== null ? parseFloat(discount) : 0;

    //Check if discount is a valid number
    if(isNaN(parsedDiscount)){
        throw new Error('Invalid discount');
    }
    //Subtract discount from the subtotal to get the grand total
    const grandTotal = subTotal - discount;
    return grandTotal.toFixed(2); // Ensure two decimal places are always displayed 
};

//Validate phone number (10 digits)
const isValidPhoneNumber = (phoneNumber) => {
    return /^\d{10}$/.test(phoneNumber);
};




//get all bills
const getBills = async (req, res)=> {

    try{
        const bills = await Bill.find({}).lean();
    
            if(!bills){
                return res.status(404).json({ error: 'No such bill' });
            }
        
            //constructing the response object with _id renamed to invoiceID and excluding _id from medicines
            const response = bills.map(bill => {
                const {_id, pharmacistID,customerID, invoiceDate, medicines, discount } = bill;

                const transformedMedicines = medicines.map((medicine, index) => ({
                    index: index + 1, // Add auto-generated index for each medicine
                    ...medicine,
                    calculateItemTotal: calculateItemTotal(medicine)
                }));// Calculate total cost for each medicine
                    
                        //Calculate subtotal for the bill
                        const subTotal = calculateSubTotal(transformedMedicines);

                        //Calculate grand total for the bill
                        const grandTotal = calculateGrandTotal(subTotal, discount || 0);

                return {
                        invoiceID: _id, // Rename _id to invoiceID
                        pharmacistID,
                        customerID,
                        invoiceDate,
                        medicines: transformedMedicines,
                        subTotal: subTotal, // Ensure two decimal places are always displayed
                        discount: discount || 0, //Include discount if it exists
                        grandTotal: grandTotal 

                    };
                });
                //Remove _id from each bill in the response
                response.forEach(bill => delete bill._id);
                //send the response
                res.status(200).json(response);
            } // Add closing parenthesis here
         catch (error){
            console.error('Error fetching bills:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
    
//get a single bill
const getBill = async(req, res) => {
    const { id } = req.params;

    try{
        //Find the bill by invoiceID
        const bill = await Bill.findById(id).lean();
    
    //chehck if the bill exists
    if(!bill){
       return  res.status(404).json({error: 'No such bill'});
    }

    // Exclude _id from each medicine object
    const medicines = bill.medicines.map(({ _id, ...medicine }, index) => ({ 
        index: index + 1,
        ...medicine, 
        calculateItemTotal: calculateItemTotal(medicine)
     }));
    const subTotal = calculateSubTotal(medicines);

    //Calculate grand total for the bill
    const grandTotal = calculateGrandTotal(subTotal, bill.discount || 0);

    // Construct the response object with _id renamed to invoiceID and excluding _id from medicines
    const response ={
        invoiceID: bill._id,
        pharmacistID: bill.pharmacistID,
        customerID: bill.customerID,
        invoiceDate: bill.invoiceDate,
        medicines: medicines,
        subTotal: subTotal,
        discount: bill.discount || 0, // Include discount if it exists
        grandTotal: grandTotal

    };

    //Remove _id from the response
    delete response._id;
    //send the response
    res.status(200).json(response);
}catch(error){
    //handle error
    console.error('Error fetching bill:', error);
    res.status(500).json({ error: 'Internal sever error'});
}
};

//create a new bill
const createBill = async (req, res) => {
    const { pharmacistID, customerID, invoiceDate, medicines} = req.body;

    // generate a new objectID for the invoiceID
    const invoiceID = new Types.ObjectId();

    // Validate customerID
    if (!isValidPhoneNumber(customerID)) {
        return res.status(400).json({ error: 'Invalid customerID. It should be a 10-digit phone number' });
    }

    try {
       
        // Retrieve discount for the user
        const discount = await retrieveDiscountForUser(customerID);

        // Fetch the unit price for each medicine and include it in the bill
        const medicinesWithPrice = [];
        let subTotal = 0;



        for (const medicine of medicines) {
            const medicineInfo = await MedicineName.findOne({ drugName: medicine.drugName }).lean();
           
               if (!medicineInfo) {
                   return res.status(400).json({ error:` No such medicine: ${medicine.drugName}`});
               }
        
            // Fetch the unit price for the medicine from the Drug model
            const drug = await Drug.findOne({ drugName: medicineInfo._id }).lean(); 
            if (!drug) {
                return res.status(400).json({ error: `No such medicine: ${medicine.drugName}` });
            }


            // Include the unit price in the medicine object
            const medicineWithPrice = {
                drugName: medicineInfo.drugName,
                ...medicine,
                price: drug.price,
                calculateItemTotal: calculateItemTotal(medicine)
            };
            subTotal += parseFloat(medicineWithPrice.calculateItemTotal);
            medicinesWithPrice.push(medicineWithPrice);
        }

       

        // Create a new bill document in the database
        const bill = await Bill.create({
            _id: invoiceID,
            pharmacistID,
            customerID,
            invoiceDate,
            medicines: Array.isArray(medicinesWithPrice) ? medicinesWithPrice : [], // Ensure that medicines is an array
            discount: discount,
        });

        
        // Update coupon status to "used" if discount is applied
        if (discount > 0) {
            // Find the user to update the coupon status
            const user = await User.findOne({ contact: customerID });
            if (user) {
                const validCoupon = user.coupons.find(coupon => !coupon.used && new Date(coupon.expire) >= new Date());
                if (validCoupon) {
                    validCoupon.used = true;
                    await user.save(); // Save the user to update the coupon status
                }
            }
        }

        

         // Calculate discount amount based on subtotal
         const discountAmount = calculateDiscountAmount(subTotal, discount);
        
        // Save the updated bill
        await bill.save();

        const response = {
            invoiceID: bill._id,
            pharmacistID,
            customerID,
            invoiceDate,
            medicines: bill.medicines.map(medicine => ({
                drugName: medicine.drugName,
                purchaseQuantity: medicine.purchaseQuantity,
                price: medicine.price,
                calculateItemTotal: medicine.calculateItemTotal
            })),
            subTotal: subTotal.toFixed(2), // Ensure two decimal places are always displayed
            discount: discount, // Include the calculated discount amount
            discountAmount: discountAmount, // Ensure two decimal places are always displayed
            grandTotal: (subTotal - discountAmount).toFixed(2) // Calculate grand total and ensure two decimal places are always displayed
        };

        // Remove _id from the response
        delete response._id;

        // Send the response
        res.status(200).json(response);

    } catch (error) {
        // Handle errors
        console.error('Error creating bill:', error);
        res.status(400).json({ error: error.message });
    }
};



//delete a medicine from a bill
const deleteMedicineFromBill = async(req, res) => {
   const { invoiceID, medicineIndex } = req.params;

   try{
        const bill= await Bill.findById(invoiceID);

        if(!bill){
        return res.status(404).json({error: 'No such bill'});
    }
    
    // Find the medicine with the specified index
    const index = parseInt(medicineIndex) - 1;

    //Check if the index is within the valid range
    if (index < 0 || index >= bill.medicines.length) {
        return res.status(404).json({ error: 'Medicine not found in the bill' });
    }
    
    //Remove the medicine from the bill's medicines array
    bill.medicines.splice(index, 1);

    //save the bill
    await bill.save();

    //Send a success response
   res.status(200).json({message:'Medicine deleted from the bill'});
} catch (error) {
    //Handle errors
    console.error('Error deleting medicine from bill:', error)
    res.status(500).json({ error: 'Internal server error' })
}
};


//update a bill
const updateBill = async(req, res) => {
    const { id } = req.params;
    
    if(!Types.ObjectId.isValid(id)){
        return res.status(404).json({error: 'No such bill'});
   }

  try{

    //Extract feilds to update from the request body
    const { customerID, invoiceDate, medicines } = req.body;

    //Validate customerID
    if(customerID && !isValidPhoneNumber(customerID)){
        return res.status(400).json({error: 'Invalid customerID. It should be a 10-digit phone number'});
    }

    //Find the exisiting bill in the database
    let existingBill = await Bill.findById(id);

     //Check if the bill exists
     if(!existingBill){
        return res.status(404).json({error: 'No such bill'});
    }
  
    // Update the specified fields if provided
    if(customerID){
        existingBill.customerID = customerID;
    }   
    if(invoiceDate){
        existingBill.invoiceDate = invoiceDate;
    }
    
   
    // Add new medicine to the bill
    if (medicines && Array.isArray(medicines) && medicines.length > 0) {
    for (const { drugName, purchaseQuantity, price } of medicines) {
        const existingMedicineIndex = existingBill.medicines.findIndex(medicine => medicine.drugName === drugName);
        if (existingMedicineIndex !== -1) {
            // If medicine already exists, update the purchase quantity
            existingBill.medicines[existingMedicineIndex].purchaseQuantity = purchaseQuantity;
            existingBill.medicines[existingMedicineIndex].calculateItemTotal = calculateItemTotal(existingBill.medicines[existingMedicineIndex]);
        } else {
            // If medicine does not exist, add it to the bill along with unit price
            existingBill.medicines.push({
                drugName,
                purchaseQuantity,
                price,
                calculateItemTotal: calculateItemTotal({ drugName, purchaseQuantity, price })
            });
        }
    }
}

    //update the bill with the calculated subtotal 
    existingBill.calculateSubTotal = calculateSubTotal(existingBill.medicines);

    //Retrive the discount from the existing bill
    const discount = existingBill.discount || 0;

    //Update grand total for the bill
    existingBill.grandTotal = calculateGrandTotal(existingBill.calculateSubTotal, discount);

    //Save the updated bill
    await existingBill.save();

    //Send the response
    res.status(200).json(existingBill);

} catch (error) {
    //Handle errors
    console.error('Error updating bill:', error);
    res.status(500).json({ error: 'Internal server error' });
}
};






export{
    
    getBills,
    getBill,
    createBill,
    deleteMedicineFromBill,
    updateBill,
    retrieveDiscountForUser,
   
}