import { supabase } from '../config/Supabase.js';

// Add a new worker
export const addWorker = async (req, res) => {
    try {
        const tenantId = req.tenant_id;
        const { name, phone, email, join_date, address, salary, allowance, payment_cycle } = req.body;

        console.log('📝 Adding worker:', { name, salary, tenantId });   

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        // Basic validation
        if (!name || !phone || !join_date || !salary) {
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        const workerData = {
            tenant_id: tenantId,
            name,
            phone,
            email: email || null,
            join_date,
            address: address || null,
            salary: parseFloat(salary),
            allowance: parseFloat(allowance) || 0,
            payment_cycle: payment_cycle || 'monthly',
            created_at: new Date().toISOString()
        };

        const { data: newWorker, error: insertError } = await supabase
            .from('workers')
            .insert([workerData])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
        }

        console.log('✅ Worker added successfully:', newWorker);

        res.status(201).json({
            message: 'Worker added successfully',
            worker: newWorker
        });

    } catch (err) {
        console.error('❌ Failed to add worker:', err);
        res.status(500).json({ error: 'Failed to add worker. ' + err.message });
    }
};

// Get all workers
export const getAllWorkers = async (req, res) => {
    try {
        const tenantId = req.tenant_id;

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        const { data: workers, error } = await supabase
            .from('workers')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching workers:', error);
            throw error;
        }

        res.json({
            message: 'Workers retrieved successfully',
            workers: workers || []
        });

    } catch (err) {
        console.error('❌ Failed to fetch workers:', err);
        res.status(500).json({ error: 'Failed to fetch workers. ' + err.message });
    }
};

// Get worker by ID
export const getWorkerById = async (req, res) => {
    try {
        const tenantId = req.tenant_id;
        const { id } = req.params;

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        const { data: worker, error } = await supabase
            .from('workers')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .single();

        if (error || !worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        res.json({
            message: 'Worker retrieved successfully',
            worker
        });

    } catch (err) {
        console.error('❌ Failed to fetch worker:', err);
        res.status(500).json({ error: 'Failed to fetch worker. ' + err.message });
    }
};

// Update worker
export const updateWorker = async (req, res) => {
    try {
        const tenantId = req.tenant_id;
        const { id } = req.params;
        const { name, phone, email, join_date, address, salary, allowance, payment_cycle } = req.body;

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        // Check if worker exists and belongs to tenant
        const { data: existingWorker, error: checkError } = await supabase
            .from('workers')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .single();

        if (checkError || !existingWorker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const updateData = {
            name,
            phone,
            email: email || null,
            join_date,
            address: address || null,
            salary: parseFloat(salary),
            allowance: parseFloat(allowance) || 0,
            payment_cycle: payment_cycle || 'monthly',
            updated_at: new Date().toISOString()
        };

        const { data: updatedWorker, error: updateError } = await supabase
            .from('workers')
            .update(updateData)
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
        }

        console.log('✅ Worker updated successfully:', updatedWorker);

        res.json({
            message: 'Worker updated successfully',
            worker: updatedWorker
        });

    } catch (err) {
        console.error('❌ Failed to update worker:', err);
        res.status(500).json({ error: 'Failed to update worker. ' + err.message });
    }
};

// Delete worker
export const deleteWorker = async (req, res) => {
    try {
        const tenantId = req.tenant_id;
        const { id } = req.params;

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        // Check if worker exists and belongs to tenant
        const { data: existingWorker, error: checkError } = await supabase
            .from('workers')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('id', id)
            .single();

        if (checkError || !existingWorker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const { error: deleteError } = await supabase
            .from('workers')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            throw deleteError;
        }

        console.log('✅ Worker deleted successfully');

        res.json({
            message: 'Worker removed successfully'
        });

    } catch (err) {
        console.error('❌ Failed to delete worker:', err);
        res.status(500).json({ error: 'Failed to delete worker. ' + err.message });
    }
};

// Record salary payment
export const recordPayment = async (req, res) => {
    try {
        const tenantId = req.tenant_id;
        const { worker_id, amount, payment_date, payment_method, notes } = req.body;

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        if (!worker_id || !amount || !payment_date) {
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        // Check if worker belongs to tenant
        const { data: worker, error: workerError } = await supabase
            .from('workers')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('id', worker_id)
            .single();

        if (workerError || !worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const paymentData = {
            tenant_id: tenantId,
            worker_id,
            amount: parseFloat(amount),
            payment_date,
            payment_method: payment_method || 'cash',
            notes: notes || null,
            created_at: new Date().toISOString()
        };

        const { data: newPayment, error: insertError } = await supabase
            .from('worker_payments')
            .insert([paymentData])
            .select()
            .single();

        if (insertError) {
            console.error('Insert payment error:', insertError);
            throw insertError;
        }

        console.log('✅ Payment recorded successfully:', newPayment);

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: newPayment
        });

    } catch (err) {
        console.error('❌ Failed to record payment:', err);
        res.status(500).json({ error: 'Failed to record payment. ' + err.message });
    }
};

// Get payment history for a worker
export const getPaymentHistory = async (req, res) => {
    try {
        const tenantId = req.tenant_id;
        const { workerId } = req.params;

        if (!tenantId) {
            return res.status(401).json({ error: 'Unauthorized: tenant_id missing' });
        }

        const { data: payments, error } = await supabase
            .from('worker_payments')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('worker_id', workerId)
            .order('payment_date', { ascending: false });

        if (error) {
            console.error('❌ Error fetching payments:', error);
            throw error;
        }

        res.json({
            message: 'Payment history retrieved successfully',
            payments: payments || []
        });

    } catch (err) {
        console.error('❌ Failed to fetch payment history:', err);
        res.status(500).json({ error: 'Failed to fetch payment history. ' + err.message });
    }
};
