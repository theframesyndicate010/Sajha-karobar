document.addEventListener('DOMContentLoaded', function () {
  // Image Slider functionality
  const slides = [
    '/assets/images/pic1.png',
    '/assets/images/pic2.png',
    '/assets/images/pic3.png'
  ];
  let currentIndex = 0;
  const slideImg = document.getElementById('slideImg');
  window.goToSlide = function (index) {
    currentIndex = index;
    slideImg.src = slides[currentIndex];
  };
  // Initialize first slide
  goToSlide(0);
  // Auto-slide every 4 seconds
  setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    goToSlide(currentIndex);
  }, 4000);

  // Login form functionality
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate inputs
    if (!email || !password) {
      showError('Please fill in all fields');
      return;
    }

    // Disable submit button during request
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    errorMessage.classList.add('hidden');

    try {
      // Make API call to backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.message || 'Login failed. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
        return;
      }

      // Store token in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('loginTimestamp', Date.now().toString());
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('tenant', JSON.stringify(data.tenant));

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login error:', error);
      showError('An error occurred. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }
});