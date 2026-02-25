(async () => {
    try {
        console.log('Attempting login...');
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@example.com',
                password: 'ChangeMe123!'
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Login Successful!');
            console.log('Token received:', data.token ? 'YES' : 'NO');
            console.log('User Role:', data.user ? data.user.role : 'Unknown');
        } else {
            console.error('Login Failed:', data);
        }
    } catch (error) {
        console.error('Network/Script Error:', error);
    }
})();
