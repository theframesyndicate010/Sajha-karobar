document.addEventListener('DOMContentLoaded', function () {
  const signupForm = document.getElementById('signupForm');
  const errorDiv = document.getElementById('error');
  const submitBtn = signupForm.querySelector('button[type="submit"]');

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form values
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const tenant = document.getElementById('tenant').value.trim();
    const shopType = document.getElementById('shopType').value;

    // Validate inputs
    if (!name || !email || !password || !tenant || !shopType) {
      showError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
    errorDiv.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          password, 
          tenant_name: tenant, 
          shop_type_name: shopType 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || data.message || 'Signup failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        return;
      }

      // Success
      alert('Account created successfully! Please log in.');
      window.location.href = '/login';
    } catch (error) {
      console.error('Signup error:', error);
      showError('An error occurred. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
});