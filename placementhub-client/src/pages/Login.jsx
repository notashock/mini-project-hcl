// src/pages/Login.jsx
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    // State to toggle between Login and Register modes
    const [isLogin, setIsLogin] = useState(true);
    
    // Form states
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const { login, register } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isLogin) {
            login(username, password, navigate);
        } else {
            // Wait for registration to complete, then switch back to login mode automatically
            await register(username, email, password, navigate);
            setIsLogin(true); 
            setPassword(''); // Clear password for security after registering
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-900">
            <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg transition-all duration-300">
                <h2 className={`text-3xl font-bold mb-6 text-center ${isLogin ? 'text-blue-400' : 'text-green-400'}`}>
                    {isLogin ? 'Login' : 'Register'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-300 mb-1">Username</label>
                        <input 
                            type="text" 
                            className={`w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none ${isLogin ? 'focus:border-blue-500' : 'focus:border-green-500'}`}
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                        />
                    </div>

                    {/* Email field ONLY shows when registering */}
                    {!isLogin && (
                        <div className="animate-fade-in">
                            <label className="block text-gray-300 mb-1">Email</label>
                            <input 
                                type="email" 
                                className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required={!isLogin} 
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-gray-300 mb-1">Password</label>
                        <input 
                            type="password" 
                            className={`w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none ${isLogin ? 'focus:border-blue-500' : 'focus:border-green-500'}`}
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>

                    <button 
                        type="submit" 
                        className={`w-full font-bold py-2 px-4 rounded transition text-white ${
                            isLogin 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <p className="text-gray-400 mt-4 text-center cursor-pointer">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span 
                        onClick={() => setIsLogin(!isLogin)} 
                        className={`hover:underline ${isLogin ? 'text-blue-400' : 'text-green-400'}`}
                    >
                        {isLogin ? 'Register here' : 'Login here'}
                    </span>
                </p>
            </div>
        </div>
    );
}