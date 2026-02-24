export const createBill = async (req, res, next) => {
    try {
        console.log('📝 Creating bill with data:', req.body);
        
        const {
            bill_number,
            bill_title,
            bill_date,
            bill_type,
            party_name,
            contact_number,
            email,
            address,
            subtotal,
            discount_percent,
            discount_amount,
            total_amount,
            payment_method,
            payment_type,
            paid_amount,
            remaining_balance,
            notes,
            items
        } = req.body;

        // Validate required fields
        if (!bill_number || !bill_title || !bill_date || !bill_type || !party_name || !total_amount) {
            console.error('❌ Missing required fields:', { bill_number, bill_title, bill_date, bill_type, party_name, total_amount });
            const error = new Error('Missing required fields');
            error.status = 400;
            throw error;
        }

        const db = req.db;

        // For sell bills, validate stock availability before proceeding
        if (bill_type === 'sell' && items && items.length > 0) {
            for (const item of items) {
                const { data: matchingProducts } = await db
                    .from('products')
                    .select('id, stock_quantity, min_size, max_size, name')
                    .eq('tenant_id', req.tenant_id)
                    .ilike('name', item.product_name);

                const itemMinSize = item.min_size || 0;
                const itemMaxSize = item.max_size || 0;
                const productData = (matchingProducts || []).find(
                    p => p.min_size === itemMinSize && p.max_size === itemMaxSize
                ) || null;

                if (!productData) {
                    const error = new Error(`Product "${item.product_name}" (size ${itemMinSize}-${itemMaxSize}) not found in stock`);
                    error.status = 400;
                    throw error;
                }

                if (productData.stock_quantity < item.quantity) {
                    const error = new Error(`Insufficient stock for "${item.product_name}" (size ${itemMinSize}-${itemMaxSize}). Available: ${productData.stock_quantity}, Requested: ${item.quantity}`);
                    error.status = 400;
                    throw error;
                }
            }
        }

        // Insert bill
        const { data: billData, error: billError } = await db
            .from('bills')
            .insert([
                {
                    tenant_id: req.tenant_id,
                    bill_number,
                    bill_title,
                    bill_date,
                    bill_type,
                    party_name,
                    contact_number: contact_number || null,
                    email: email || null,
                    address: address || null,
                    subtotal: subtotal || 0,
                    discount_percent: discount_percent || 0,
                    discount_amount: discount_amount || 0,
                    total_amount,
                    payment_method: payment_method || null,
                    payment_type: payment_type || 'full',
                    paid_amount: paid_amount || 0,
                    remaining_balance: remaining_balance || total_amount,
                    notes: notes || null,
                    status: paid_amount >= total_amount ? 'paid' : (paid_amount > 0 ? 'partially_paid' : 'unpaid')
                }
            ])
            .select();

        if (billError) {
            const error = new Error(billError.message || 'Failed to create bill');
            error.status = 500;
            throw error;
        }

        const billId = billData[0].bill_id;

        // Insert bill items and update stock
        if (items && items.length > 0) {
            const billItems = items.map(item => ({
                bill_id: billId,
                product_name: item.product_name,
                quantity: item.quantity,
                min_size: item.min_size || null,
                max_size: item.max_size || null,
                unit: item.unit,
                unit_price: item.unit_price,
                total_price: item.quantity * item.unit_price
            }));

            const { error: itemsError } = await db
                .from('bill_items')
                .insert(billItems);

            if (itemsError) {
                const error = new Error(itemsError.message || 'Failed to add bill items');
                error.status = 500;
                throw error;
            }

            // Update product stock based on bill type
            for (const item of items) {
                // Get product by name (scoped to tenant) — may return multiple with different sizes
                const { data: matchingProducts, error: productError } = await db
                    .from('products')
                    .select('id, stock_quantity, min_size, max_size')
                    .eq('tenant_id', req.tenant_id)
                    .ilike('name', item.product_name);

                // Find exact match on size range
                const itemMinSize = item.min_size || 0;
                const itemMaxSize = item.max_size || 0;
                const productData = (matchingProducts || []).find(
                    p => p.min_size === itemMinSize && p.max_size === itemMaxSize
                ) || null;

                // If no exact match found and it's a buy bill, create new product or add to existing
                if (!productData && bill_type === 'buy') {
                    console.log(`Creating new product "${item.product_name}" (size ${itemMinSize}-${itemMaxSize}) for purchase bill`);
                    
                    // Get category_id from category name
                    let categoryId = null;
                    if (item.category) {
                        const { data: categoryData } = await db
                            .from('categories')
                            .select('id')
                            .eq('name', item.category)
                            .single();
                        
                        if (categoryData) {
                            categoryId = categoryData.id;
                        }
                    }
                    
                    const { data: newProduct, error: createError } = await db
                        .from('products')
                        .insert([{
                            tenant_id: req.tenant_id,
                            name: item.product_name,
                            category_id: categoryId,
                            price: item.unit_price,
                            min_size: item.min_size || 0,
                            max_size: item.max_size || 0,
                            stock_quantity: item.quantity,
                            created_at: new Date().toISOString()
                        }])
                        .select()
                        .single();

                    if (createError) {
                        console.warn(`Failed to create product "${item.product_name}":`, createError.message);
                    } else {
                        console.log(`Successfully created product "${item.product_name}" with stock ${item.quantity}`);
                    }
                    continue;
                }

                if (!productData && bill_type === 'sell') {
                    console.warn(`Product "${item.product_name}" (size ${itemMinSize}-${itemMaxSize}) not found for sell bill, skipping stock update`);
                    continue;
                }

                if (productData) {
                    // Calculate new stock quantity
                    let newStockQuantity = productData.stock_quantity;
                    
                    if (bill_type === 'sell') {
                        // Decrease stock when selling
                        newStockQuantity = productData.stock_quantity - item.quantity;
                    } else if (bill_type === 'buy') {
                        // Increase stock when buying
                        newStockQuantity = productData.stock_quantity + item.quantity;
                    }

                    console.log(`Updating stock for "${item.product_name}": ${productData.stock_quantity} -> ${newStockQuantity} (bill_type: ${bill_type})`);

                    // Update product stock
                    const { error: updateError } = await db
                        .from('products')
                        .update({ stock_quantity: newStockQuantity })
                        .eq('id', productData.id);

                    if (updateError) {
                        console.warn(`Failed to update stock for product "${item.product_name}":`, updateError.message);
                    } else {
                        console.log(`Successfully updated stock for "${item.product_name}"`);
                    }
                }
            }

            // Create sales records for sell bills
            if (bill_type === 'sell') {
                console.log('📊 Creating sales records for sell bill');
                
                for (const item of items) {
                    const { error: saleError } = await db
                        .from('sales')
                        .insert([{
                            tenant_id: req.tenant_id,
                            product_id: (await db
                                .from('products')
                                .select('id')
                                .eq('tenant_id', req.tenant_id)
                                .ilike('name', item.product_name)
                                .single()).data?.id,
                            quantity_sold: item.quantity,
                            unit_price: item.unit_price,
                            total_amount: item.quantity * item.unit_price,
                            sale_date: bill_date,
                            notes: notes || null,
                            created_at: new Date().toISOString()
                        }]);

                    if (saleError) {
                        console.warn(`Failed to create sale for "${item.product_name}":`, saleError.message);
                    } else {
                        console.log(`✅ Sale created for "${item.product_name}"`);
                    }
                }
            }
        }

        console.log('✅ Bill created successfully:', billData[0]);
        res.status(201).json(billData[0]);
    } catch (err) {
        console.error('❌ Error creating bill:', err);
        next(err);
    }
};

export const getBills = async (req, res, next) => {
    try {
        const db = req.db;
        const { bill_type, status, start_date, end_date } = req.query;

        let query = db
            .from('bills')
            .select('*')
            .eq('tenant_id', req.tenant_id);

        if (bill_type) {
            query = query.eq('bill_type', bill_type);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (start_date) {
            query = query.gte('bill_date', start_date);
        }

        if (end_date) {
            query = query.lte('bill_date', end_date);
        }

        const { data, error } = await query.order('bill_date', { ascending: false });

        if (error) {
            const dbError = new Error(error.message || 'Failed to fetch bills');
            dbError.status = 500;
            throw dbError;
        }

        res.json(data);
    } catch (err) {
        next(err);
    }
};

export const getBillById = async (req, res, next) => {
    try {
        const { billId } = req.params;
        const db = req.db;

        // Get bill details
        const { data: billData, error: billError } = await db
            .from('bills')
            .select('*')
            .eq('bill_id', billId)
            .eq('tenant_id', req.tenant_id)
            .single();

        if (billError || !billData) {
            const error = new Error('Bill not found');
            error.status = 404;
            throw error;
        }

        // Get bill items
        const { data: itemsData, error: itemsError } = await db
            .from('bill_items')
            .select('*')
            .eq('bill_id', billId);

        if (itemsError) {
            const error = new Error(itemsError.message || 'Failed to fetch bill items');
            error.status = 500;
            throw error;
        }

        // Get payment history
        const { data: paymentsData, error: paymentsError } = await db
            .from('bill_payments')
            .select('*')
            .eq('bill_id', billId)
            .order('payment_date', { ascending: false });

        if (paymentsError) {
            const error = new Error(paymentsError.message || 'Failed to fetch payment history');
            error.status = 500;
            throw error;
        }

        res.json({
            bill: billData,
            items: itemsData || [],
            payments: paymentsData || []
        });
    } catch (err) {
        next(err);
    }
};

export const updateBill = async (req, res, next) => {
    try {
        const { billId } = req.params;
        const { bill_title, party_name, contact_number, email, address, notes } = req.body;

        const db = req.db;

        const { data, error } = await db
            .from('bills')
            .update({
                bill_title,
                party_name,
                contact_number,
                email,
                address,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('bill_id', billId)
            .eq('tenant_id', req.tenant_id)
            .select();

        if (error) {
            const dbError = new Error(error.message || 'Failed to update bill');
            dbError.status = 500;
            throw dbError;
        }

        if (!data || data.length === 0) {
            const notFoundError = new Error('Bill not found');
            notFoundError.status = 404;
            throw notFoundError;
        }

        res.json(data[0]);
    } catch (err) {
        next(err);
    }
};

export const recordPayment = async (req, res, next) => {
    try {
        const { billId } = req.params;
        const { payment_amount, payment_date, payment_method, notes } = req.body;

        // Validate required fields
        if (!payment_amount || !payment_date) {
            const error = new Error('Payment amount and date are required');
            error.status = 400;
            throw error;
        }

        const db = req.db;

        // Get current bill
        const { data: billData, error: billError } = await db
            .from('bills')
            .select('*')
            .eq('bill_id', billId)
            .eq('tenant_id', req.tenant_id)
            .single();

        if (billError || !billData) {
            const error = new Error('Bill not found');
            error.status = 404;
            throw error;
        }

        // Calculate new paid amount and remaining balance
        const newPaidAmount = billData.paid_amount + payment_amount;
        const newRemainingBalance = billData.total_amount - newPaidAmount;
        const newStatus = newPaidAmount >= billData.total_amount ? 'paid' : 'partially_paid';

        // Insert payment record
        const { data: paymentData, error: paymentError } = await db
            .from('bill_payments')
            .insert([
                {
                    bill_id: billId,
                    payment_amount,
                    payment_date,
                    payment_method: payment_method || null,
                    notes: notes || null
                }
            ])
            .select();

        if (paymentError) {
            const error = new Error(paymentError.message || 'Failed to record payment');
            error.status = 500;
            throw error;
        }

        // Update bill with new payment info
        const { data: updatedBill, error: updateError } = await db
            .from('bills')
            .update({
                paid_amount: newPaidAmount,
                remaining_balance: newRemainingBalance,
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('bill_id', billId)
            .select();

        if (updateError) {
            const error = new Error(updateError.message || 'Failed to update bill');
            error.status = 500;
            throw error;
        }

        res.status(201).json({
            payment: paymentData[0],
            bill: updatedBill[0]
        });
    } catch (err) {
        next(err);
    }
};

export const deleteBill = async (req, res, next) => {
    try {
        const { billId } = req.params;
        const db = req.db;

        const { data, error } = await db
            .from('bills')
            .delete()
            .eq('bill_id', billId)
            .eq('tenant_id', req.tenant_id)
            .select();

        if (error) {
            const dbError = new Error(error.message || 'Failed to delete bill');
            dbError.status = 500;
            throw dbError;
        }

        if (!data || data.length === 0) {
            const notFoundError = new Error('Bill not found');
            notFoundError.status = 404;
            throw notFoundError;
        }

        res.json({ message: 'Bill deleted successfully' });
    } catch (err) {
        next(err);
    }
};

export const updateBillItem = async (req, res, next) => {
    try {
        const { billId, itemId } = req.params;
        const { product_name, quantity, min_size, max_size, unit, unit_price } = req.body;

        const db = req.db;

        // Verify bill belongs to tenant
        const { data: billCheck, error: billCheckError } = await db
            .from('bills')
            .select('bill_id')
            .eq('bill_id', billId)
            .eq('tenant_id', req.tenant_id)
            .single();

        if (billCheckError || !billCheck) {
            const error = new Error('Bill not found');
            error.status = 404;
            throw error;
        }

        // Calculate new total price
        const total_price = quantity * unit_price;

        const { data, error } = await db
            .from('bill_items')
            .update({
                product_name,
                quantity,
                min_size: min_size || null,
                max_size: max_size || null,
                unit,
                unit_price,
                total_price
            })
            .eq('item_id', itemId)
            .eq('bill_id', billId)
            .select();

        if (error) {
            const dbError = new Error(error.message || 'Failed to update bill item');
            dbError.status = 500;
            throw dbError;
        }

        if (!data || data.length === 0) {
            const notFoundError = new Error('Bill item not found');
            notFoundError.status = 404;
            throw notFoundError;
        }

        // Recalculate bill totals
        const { data: allItems, error: itemsError } = await db
            .from('bill_items')
            .select('total_price')
            .eq('bill_id', billId);

        if (!itemsError && allItems) {
            const newSubtotal = allItems.reduce((sum, item) => sum + item.total_price, 0);

            // Get current bill to calculate discount
            const { data: billData } = await db
                .from('bills')
                .select('discount_percent')
                .eq('bill_id', billId)
                .single();

            const discount_amount = billData ? (newSubtotal * billData.discount_percent) / 100 : 0;
            const total_amount = newSubtotal - discount_amount;

            // Update bill totals
            await db
                .from('bills')
                .update({
                    subtotal: newSubtotal,
                    discount_amount,
                    total_amount,
                    remaining_balance: total_amount,
                    updated_at: new Date().toISOString()
                })
                .eq('bill_id', billId);
        }

        res.json(data[0]);
    } catch (err) {
        next(err);
    }
};

export const deleteBillItem = async (req, res, next) => {
    try {
        const { billId, itemId } = req.params;
        const db = req.db;

        // Verify bill belongs to tenant
        const { data: billCheck, error: billCheckError } = await db
            .from('bills')
            .select('bill_id')
            .eq('bill_id', billId)
            .eq('tenant_id', req.tenant_id)
            .single();

        if (billCheckError || !billCheck) {
            const error = new Error('Bill not found');
            error.status = 404;
            throw error;
        }

        const { data, error } = await db
            .from('bill_items')
            .delete()
            .eq('item_id', itemId)
            .eq('bill_id', billId)
            .select();

        if (error) {
            const dbError = new Error(error.message || 'Failed to delete bill item');
            dbError.status = 500;
            throw dbError;
        }

        if (!data || data.length === 0) {
            const notFoundError = new Error('Bill item not found');
            notFoundError.status = 404;
            throw notFoundError;
        }

        // Recalculate bill totals
        const { data: allItems, error: itemsError } = await db
            .from('bill_items')
            .select('total_price')
            .eq('bill_id', billId);

        if (!itemsError && allItems) {
            const newSubtotal = allItems.reduce((sum, item) => sum + item.total_price, 0);

            // Get current bill to calculate discount
            const { data: billData } = await db
                .from('bills')
                .select('discount_percent')
                .eq('bill_id', billId)
                .single();

            const discount_amount = billData ? (newSubtotal * billData.discount_percent) / 100 : 0;
            const total_amount = newSubtotal - discount_amount;

            // Update bill totals
            await db
                .from('bills')
                .update({
                    subtotal: newSubtotal,
                    discount_amount,
                    total_amount,
                    remaining_balance: total_amount,
                    updated_at: new Date().toISOString()
                })
                .eq('bill_id', billId);
        }

        res.json({ message: 'Bill item deleted successfully' });
    } catch (err) {
        next(err);
    }
};

export const getBillStats = async (req, res, next) => {
    try {
        const db = req.db;
        const { start_date, end_date } = req.query;

        let query = db
            .from('bills')
            .select('bill_type, status, total_amount, paid_amount')
            .eq('tenant_id', req.tenant_id);

        if (start_date) {
            query = query.gte('bill_date', start_date);
        }

        if (end_date) {
            query = query.lte('bill_date', end_date);
        }

        const { data, error } = await query;

        if (error) {
            const dbError = new Error(error.message || 'Failed to fetch bill stats');
            dbError.status = 500;
            throw dbError;
        }

        // Calculate statistics
        const stats = {
            total_bills: data.length,
            total_amount: data.reduce((sum, bill) => sum + bill.total_amount, 0),
            total_paid: data.reduce((sum, bill) => sum + bill.paid_amount, 0),
            total_pending: data.reduce((sum, bill) => sum + (bill.total_amount - bill.paid_amount), 0),
            sell_bills: data.filter(b => b.bill_type === 'sell').length,
            buy_bills: data.filter(b => b.bill_type === 'buy').length,
            paid_bills: data.filter(b => b.status === 'paid').length,
            partially_paid_bills: data.filter(b => b.status === 'partially_paid').length,
            unpaid_bills: data.filter(b => b.status === 'unpaid').length
        };

        res.json(stats);
    } catch (err) {
        next(err);
    }
};
