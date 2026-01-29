import React, { createContext, useState, useContext, useEffect } from 'react';
    import api from '../services/api'; // Assuming api.js sets up axios instance

    const AuthContext = createContext(null);

    export const AuthProvider = ({ children }) => {
        const [user, setUser] = useState(null);
        const [token, setToken] = useState(localStorage.getItem('authToken'));
        const [loading, setLoading] = useState(true); // Add loading state

        useEffect(() => {
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                setToken(storedToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                // Fetch user profile if token exists
                api.get('/me')
                    .then(response => {
                        setUser(response.data);
                    })
                    .catch(() => {
                        // Token might be invalid/expired
                        localStorage.removeItem('authToken');
                        setToken(null);
                        setUser(null);
                        delete api.defaults.headers.common['Authorization'];
                    })
                    .finally(() => {
                        setLoading(false);
                    });
            } else {
                setLoading(false); // No token, stop loading
            }
        }, []); // Run only once on mount

        const login = async (username, password) => {
            try {
                const response = await api.post('/login', { username, password });
                const { access_token, ...userData } = response.data;
                localStorage.setItem('authToken', access_token);
                setToken(access_token);
                setUser(userData); // Store username, full_name etc.
                api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                return { success: true };
            } catch (error) {
                console.error("Login failed:", error.response?.data?.detail || error.message);
                return { success: false, message: error.response?.data?.detail || 'Login failed' };
            }
        };

         const register = async (username, email, password, fullName) => {
            try {
                const response = await api.post('/register', {
                    username,
                    email,
                    password,
                    full_name: fullName,
                });
                const { access_token, ...userData } = response.data;
                localStorage.setItem('authToken', access_token);
                setToken(access_token);
                setUser(userData);
                api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                return { success: true };
            } catch (error) {
                console.error("Registration failed:", error.response?.data?.detail || error.message);
                return { success: false, message: error.response?.data?.detail || 'Registration failed' };
            }
        };

        const logout = () => {
            localStorage.removeItem('authToken');
            setToken(null);
            setUser(null);
            delete api.defaults.headers.common['Authorization'];
        };

        // Don't render children until loading is finished
        if (loading) {
             return <div>Loading authentication state...</div>; // Or a spinner component
        }


        return (
            <AuthContext.Provider value={{ user, token, login, logout, register, loading, isAuthenticated: !!token }}>
                {children}
            </AuthContext.Provider>
        );
    };

    export const useAuth = () => {
        const context = useContext(AuthContext);
        if (context === undefined) {
            throw new Error('useAuth must be used within an AuthProvider');
        }
        return context;
    };
