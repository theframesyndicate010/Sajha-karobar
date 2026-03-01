// Import both the public and admin clients from the centralized config
import { supabase, supabaseAdmin } from '../config/Supabase.js';
import { sendOTP, verifyOTP } from '../services/mail.service.js';

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Fetch tenant info for the logged-in user
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('tenant_id')
      .eq('id', data.user.id)
      .single();

    let tenant = null;
    if (userData?.tenant_id) {
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('id, name')
        .eq('id', userData.tenant_id)
        .single();
      tenant = tenantData;
    }

    res.json({
      message: 'Logged in successfully',
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
      tenant,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const refreshSession = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const register = async (req, res) => {
  const { name, email, password, tenant_name, shop_type_name } = req.body;

  if (!name || !email || !password || !tenant_name || !shop_type_name) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // 1. Look up the shop_type_id
    const { data: shopType, error: shopTypeError } = await supabaseAdmin
      .from('shop_types')
      .select('id')
      .eq('name', shop_type_name)
      .single();

    if (shopTypeError || !shopType) {
      return res.status(400).json({ error: `Invalid shop type: '${shop_type_name}'.` });
    }
    const shopTypeId = shopType.id;

    // 2. Create the tenant first
    const { data: newTenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({ name: tenant_name, shop_type_id: shopTypeId })
      .select()
      .single();

    if (tenantError) {
      return res.status(500).json({ error: `Failed to create tenant: ${tenantError.message}` });
    }
    const tenantId = newTenant.id;

    // 3. Sign up the user with Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, tenant_id: tenantId, shop_type_id: shopTypeId },
      },
    });

    if (signUpError) {
      // If user creation fails, we should roll back the tenant creation
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      return res.status(400).json({ error: signUpError.message });
    }
    if (!authData.user) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      return res.status(500).json({ error: "User could not be created." });
    }

    // 4. Insert the user's public profile (NO PASSWORD)
    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      tenant_id: tenantId,
      shop_type_id: shopTypeId,
      email,
      name,
    });

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      return res.status(400).json({ error: `Failed to create user profile: ${insertError.message}` });
    }

    res.status(201).json({
      message: "User and tenant created successfully.",
      user: authData.user,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Verify the email exists in Supabase before sending OTP
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = userList?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    if (listError || !userExists) {
      // Don't reveal whether email exists — always return success message
      return res.json({ message: 'OTP code sent to your email' });
    }

    await sendOTP(email);
    res.json({ message: 'OTP code sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Failed to send OTP. Please try again later.' });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password, email } = req.body;
  if (!token || !password || !email) {
    return res.status(400).json({ message: 'OTP code, email, and new password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    // Verify the OTP from our mail service
    const result = verifyOTP(email, token);

    if (!result.valid) {
      return res.status(400).json({ message: result.message, code: result.code });
    }

    // Find the user by email and update password
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return res.status(500).json({ message: 'Server error. Please try again.' });
    }

    const user = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      return res.status(400).json({ message: updateError.message });
    }

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};